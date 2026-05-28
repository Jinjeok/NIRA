import { createRequire } from 'node:module';
import axios from 'axios';
import logger from '../logger.js';
import { getStateValue, setStateValue } from '../storage/appStore.js';
import { WebhookClient } from '../discord.js';

const require = createRequire(import.meta.url);
const Crawler = require('crawler');

const CRON_EXPRESSION = '0 7 * * *';
const BLOG_URL = 'https://blog.naver.com/PostList.naver?blogId=jjy4400&widgetTypeCall=true&noTrackingCode=true&directAccess=true';
const STATE_KEY = 'tenseijingo_last_content';

function parseJapaneseDate(dateString) {
    const matches = dateString.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (!matches) throw new Error(`날짜 파싱 실패: ${dateString}`);
    const [, year, month, day] = matches.map(Number);
    return new Date(year, month - 1, day).toISOString();
}

function crawlPage(url) {
    return new Promise((resolve, reject) => {
        const c = new Crawler({
            maxConnections: 1,
            callback(error, res, done) {
                done();
                if (error) return reject(error);
                resolve(res.$);
            },
        });
        c.queue(url);
    });
}

function extractContent($) {
    const arr = $('p.se-text-paragraph.se-text-paragraph-align-justify')
        .map(function () { return $(this).text().trim(); })
        .get()
        .filter(s => s !== '');

    if (!arr.length) throw new Error('본문 단락을 찾을 수 없음');

    let body = '';
    for (let i = 0; i < arr.length; i++) {
        if (i !== 0 && arr[i].includes('（天声人語）')) break;
        if (arr[i].includes('單語')) break;
        if (arr[i].match(/[ㄱ-ㅎㅏ-ㅣ가-힣]/)) continue;
        body += arr[i] + '\n\n';
    }

    const firstLine = arr[0];
    const dateIndex = firstLine.search(/\d{4}/);
    const header = firstLine.slice(0, dateIndex)
        .replace(/[ㄱ-ㅎㅏ-ㅣ가-힣!@#$%^&*(),.?":{}|<>]/g, '');
    const date = firstLine.slice(dateIndex);
    const parsedDate = parseJapaneseDate(date);
    const content = `## ${header}\n### ${date}\n${body}#天声人語`;

    return { header, date, parsedDate, content };
}

async function postToMemos(content) {
    const memosUrl = process.env.TENSEIJINGO_MEMOS_URL;
    const memosToken = process.env.TENSEIJINGO_MEMOS_TOKEN;
    if (!memosUrl || !memosToken) return null;

    const res = await axios.post(`${memosUrl}/api/v1/memos`, {
        content,
        visibility: 'PUBLIC',
    }, {
        headers: { Authorization: `Bearer ${memosToken}` },
    });
    return res.data;
}

async function postToNotion(title, date, content) {
    const notionKey = process.env.TENSEIJINGO_NOTION_KEY;
    const databaseId = process.env.TENSEIJINGO_NOTION_DB;
    if (!notionKey || !databaseId) return;

    const bodyText = content.replace(/^\s*##.*\n?|\s*###.*\n?/gm, '');
    await axios.post('https://api.notion.com/v1/pages', {
        parent: { database_id: databaseId },
        properties: {
            '이름': { title: [{ text: { content: title } }] },
            '날짜': { date: { start: date } },
        },
        children: [{
            object: 'block',
            type: 'paragraph',
            paragraph: { rich_text: [{ type: 'text', text: { content: bodyText } }] },
        }],
    }, {
        headers: {
            Authorization: `Bearer ${notionKey}`,
            'Notion-Version': '2022-06-28',
        },
    });
}

async function sendTenseijingo(client, webhookUrl, testMode = false) {
    logger.info('[Tenseijingo] 크롤링 시작...');

    let $;
    try {
        $ = await crawlPage(BLOG_URL);
    } catch (error) {
        logger.error('[Tenseijingo] 크롤링 실패:', error);
        return;
    }

    let extracted;
    try {
        extracted = extractContent($);
    } catch (error) {
        logger.error('[Tenseijingo] 콘텐츠 파싱 실패:', error);
        return;
    }

    const { header, parsedDate, content } = extracted;

    const previousContent = getStateValue(STATE_KEY);
    if (previousContent === content) {
        logger.info('[Tenseijingo] 중복 콘텐츠, 건너뜀');
        return;
    }
    setStateValue(STATE_KEY, content);

    try {
        let memoLink = null;
        if (!testMode) {
            const memo = await postToMemos(content);
            memoLink = memo?.uid && process.env.TENSEIJINGO_MEMOS_URL
                ? `${process.env.TENSEIJINGO_MEMOS_URL}/m/${memo.uid}`
                : null;
        }

        if (webhookUrl) {
            const webhook = new WebhookClient({ url: webhookUrl });
            const discordContent = memoLink
                ? `${content}\n\nPosted: <t:${Math.floor(Date.now() / 1000)}>\n[Link](${memoLink})`
                : content;
            await webhook.send({ content: discordContent });
            logger.info('[Tenseijingo] Discord 웹훅 전송 완료');
        }

        if (!testMode) {
            await postToNotion(header, parsedDate, content);
        }
        logger.info(`[Tenseijingo] 완료${testMode ? ' (테스트 모드)' : ''}`);
    } catch (error) {
        logger.error('[Tenseijingo] 전송 중 오류:', error);
    }
}

export default { sendTenseijingo, CRON_EXPRESSION };
