import { WebhookClient } from '../discord.js';
import Parser from 'rss-parser';
import logger from '../logger.js';
import { getStateValue, setStateValue } from '../storage/appStore.js';

const SEND_MODE = 'webhook';
const RSS_URL = 'https://planet.moe/@karaoke_jpop.rss';
const CRON_EXPRESSION = '0 9 * * *';
const STATE_KEY = 'karaoke_sent_links';
const MAX_STORED_LINKS = 100;

const parser = new Parser({
    customFields: {
        item: [['media:content', 'media:content', { keepArray: true }]],
    },
});

async function getNewKaraokeEmbeds() {
    const feed = await parser.parseURL(RSS_URL);
    const sentLinks = new Set(getStateValue(STATE_KEY) || []);

    const newItems = feed.items.filter(item => item.link && !sentLinks.has(item.link));

    const embeds = newItems.map(item => {
        const media = item['media:content']?.find(m => m.$?.url);
        if (!media) return null;
        return {
            title: item.title || '🎤 노래방 신곡 알림',
            image: { url: media.$.url },
            url: item.link,
            timestamp: new Date(item.pubDate).toISOString(),
            color: 0xEE82EE,
            footer: {
                icon_url: 'https://media.planet.moe/accounts/avatars/109/797/204/938/216/927/original/4928ee70039d2c7a.jpg',
                text: '게시일',
            },
        };
    }).filter(Boolean);

    return { embeds, newLinks: newItems.map(i => i.link), allLinks: [...feed.items.map(i => i.link).filter(Boolean)] };
}

function updateSentLinks(newLinks) {
    const existing = getStateValue(STATE_KEY) || [];
    const updated = [...new Set([...existing, ...newLinks])];
    // 오래된 항목 제거 (최근 MAX_STORED_LINKS개만 유지)
    setStateValue(STATE_KEY, updated.slice(-MAX_STORED_LINKS));
}

async function sendKaraokeImages(client, webhookUrl) {
    logger.info('[KaraokeSender] RSS 이미지 전송 시작...');

    let result;
    try {
        result = await getNewKaraokeEmbeds();
    } catch (error) {
        logger.error('[KaraokeSender] RSS 파싱 중 오류:', error);
        return;
    }

    const { embeds, newLinks } = result;

    if (!embeds.length) {
        logger.info('[KaraokeSender] 전송할 새 이미지가 없습니다.');
        return;
    }

    try {
        if (SEND_MODE === 'webhook') {
            if (!webhookUrl) {
                logger.error('[KaraokeSender] Webhook URL이 설정되지 않았습니다.');
                return;
            }
            const webhook = new WebhookClient({ url: webhookUrl });
            await webhook.send({ embeds });
            updateSentLinks(newLinks);
            logger.info(`[KaraokeSender] ${embeds.length}개 전송 완료.`);
        } else {
            logger.error(`[KaraokeSender] 지원하지 않는 SEND_MODE: ${SEND_MODE}`);
        }
    } catch (error) {
        logger.error('[KaraokeSender] 전송 중 오류:', error);
    }
}

export default { sendKaraokeImages, CRON_EXPRESSION };
