import { WebhookClient } from '../discord.js';
import Parser from 'rss-parser';
import logger from '../logger.js';
import { getStateValue, setStateValue } from '../storage/appStore.js';

const SEND_MODE = 'webhook';
const RSS_URL = 'https://planet.moe/@karaoke_jpop.rss';
const CRON_EXPRESSION = '0 9 * * *';
const STATE_KEY = 'karaoke_sent_links';
const MAX_STORED_LINKS = 100;
const MAX_EMBEDS_PER_MESSAGE = 10;

const parser = new Parser({
    customFields: {
        item: [['media:content', 'media:content', { keepArray: true }]],
    },
});

async function getNewKaraokeEmbeds() {
    const feed = await parser.parseURL(RSS_URL);
    const sentLinks = new Set(getStateValue(STATE_KEY) || []);

    const newItems = feed.items.filter(item => item.link && !sentLinks.has(item.link));

    const parsedItems = newItems.map(item => {
        const media = item['media:content']?.find(m => m.$?.url);
        if (!media) return { link: item.link, embed: null };

        return {
            link: item.link,
            embed: {
                title: item.title || '🎤 노래방 신곡 알림',
                image: { url: media.$.url },
                url: item.link,
                timestamp: new Date(item.pubDate).toISOString(),
                color: 0xEE82EE,
                footer: {
                    icon_url: 'https://media.planet.moe/accounts/avatars/109/797/204/938/216/927/original/4928ee70039d2c7a.jpg',
                    text: '게시일',
                },
            },
        };
    });
    const entries = parsedItems.filter(item => item.embed);
    const skippedLinks = parsedItems.filter(item => !item.embed).map(item => item.link);

    return { entries, skippedLinks, allLinks: [...feed.items.map(i => i.link).filter(Boolean)] };
}

function chunkArray(items, size) {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
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

    const { entries, skippedLinks } = result;

    if (!entries.length) {
        if (skippedLinks.length) {
            updateSentLinks(skippedLinks);
            logger.warn(`[KaraokeSender] 이미지가 없는 새 항목 ${skippedLinks.length}개를 전송 없이 처리했습니다.`);
        }
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
            const batches = chunkArray(entries, MAX_EMBEDS_PER_MESSAGE);

            for (const [index, batch] of batches.entries()) {
                await webhook.send({ embeds: batch.map(entry => entry.embed) });
                updateSentLinks(batch.map(entry => entry.link));
                logger.info(`[KaraokeSender] ${batch.length}개 전송 완료 (${index + 1}/${batches.length}).`);
            }

            if (skippedLinks.length) {
                updateSentLinks(skippedLinks);
                logger.warn(`[KaraokeSender] 이미지가 없는 새 항목 ${skippedLinks.length}개를 전송 없이 처리했습니다.`);
            }

            logger.info(`[KaraokeSender] 총 ${entries.length}개 전송 완료.`);
        } else {
            logger.error(`[KaraokeSender] 지원하지 않는 SEND_MODE: ${SEND_MODE}`);
        }
    } catch (error) {
        logger.error('[KaraokeSender] 전송 중 오류:', error);
    }
}

export default { sendKaraokeImages, CRON_EXPRESSION };
