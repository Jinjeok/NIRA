import { WebhookClient } from '../discord.js';
import Parser from 'rss-parser';
import logger from '../logger.js';
import { getStateValue, setStateValue } from '../storage/appStore.js';

const SEND_MODE = 'webhook';
const RSS_URL = 'https://planet.moe/@karaoke_jpop.rss';
const CRON_EXPRESSION = '0 9 * * *';
const STATE_KEY = 'karaoke_sent_links_by_type';
const MAX_STORED_LINKS = 100;
const ITEM_TYPES = [
    {
        key: 'regular',
        label: '일반 신곡',
        fallbackTitle: '🎤 노래방 신곡 알림',
        color: 0xEE82EE,
    },
    {
        key: 'monthly_summary',
        label: '월간 신곡 종합',
        fallbackTitle: '📊 노래방 월간 신곡 종합',
        color: 0xFFD166,
    },
];

const parser = new Parser({
    customFields: {
        item: [['media:content', 'media:content', { keepArray: true }]],
    },
});

function getItemTimestamp(item) {
    const timestamp = Date.parse(item.isoDate || item.pubDate || '');
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getItemIsoTimestamp(item) {
    const timestamp = getItemTimestamp(item);
    return new Date(timestamp || Date.now()).toISOString();
}

function getLatestItem(items) {
    return items
        .map((item, index) => ({ item, index, timestamp: getItemTimestamp(item) }))
        .sort((a, b) => b.timestamp - a.timestamp || a.index - b.index)[0]?.item;
}

function getItemCategories(item) {
    const categories = [];
    if (Array.isArray(item.categories)) categories.push(...item.categories);
    if (Array.isArray(item.category)) categories.push(...item.category);
    if (typeof item.category === 'string') categories.push(item.category);
    return categories.filter(Boolean);
}

function getItemSearchText(item) {
    return [
        item.title,
        item.content,
        item.contentSnippet,
        item.description,
        ...getItemCategories(item),
    ].filter(Boolean).join(' ');
}

function isMonthlySummaryItem(item) {
    const categories = getItemCategories(item);
    if (categories.includes('신곡일람')) return true;

    const searchText = getItemSearchText(item);
    return /신곡\s*종합|월간\s*신곡|월간\s*정산/.test(searchText);
}

function getItemType(item) {
    return isMonthlySummaryItem(item) ? ITEM_TYPES[1] : ITEM_TYPES[0];
}

function getLatestItemsByType(items) {
    return ITEM_TYPES
        .map(type => ({
            type,
            item: getLatestItem(items.filter(item => getItemType(item).key === type.key)),
        }))
        .filter(candidate => candidate.item);
}

function createLinksByType() {
    return Object.fromEntries(ITEM_TYPES.map(type => [type.key, []]));
}

function getLinksByType(items) {
    const linksByType = createLinksByType();
    for (const item of items) {
        linksByType[getItemType(item).key].push(item.link);
    }
    return linksByType;
}

function getSentLinksByType() {
    const stored = getStateValue(STATE_KEY) || {};
    const sentLinksByType = createLinksByType();

    for (const type of ITEM_TYPES) {
        if (Array.isArray(stored[type.key])) {
            sentLinksByType[type.key] = stored[type.key];
        }
    }

    return sentLinksByType;
}

function createKaraokeEntry(item, type) {
    const media = item['media:content']?.find(m => m.$?.url);
    if (!media) return null;

    return {
        link: item.link,
        type,
        embed: {
            title: item.title || type.fallbackTitle,
            image: { url: media.$.url },
            url: item.link,
            timestamp: getItemIsoTimestamp(item),
            color: type.color,
            footer: {
                icon_url: 'https://media.planet.moe/accounts/avatars/109/797/204/938/216/927/original/4928ee70039d2c7a.jpg',
                text: `${type.label} · 게시일`,
            },
        },
    };
}

async function getLatestKaraokeEntries() {
    const feed = await parser.parseURL(RSS_URL);
    const sentLinksByType = getSentLinksByType();
    const feedItems = feed.items.filter(item => item.link);
    const allLinksByType = getLinksByType(feedItems);
    const latestCandidates = getLatestItemsByType(feedItems);

    if (!latestCandidates.length) {
        return { entries: [], allLinksByType, sentLabels: [], skippedLabels: [], status: 'empty' };
    }

    const entries = [];
    const sentLabels = [];
    const skippedLabels = [];

    for (const { type, item } of latestCandidates) {
        const sentLinks = new Set(sentLinksByType[type.key] || []);
        if (sentLinks.has(item.link)) {
            sentLabels.push(type.label);
            continue;
        }

        const entry = createKaraokeEntry(item, type);
        if (entry) {
            entries.push(entry);
        } else {
            skippedLabels.push(type.label);
        }
    }

    return { entries, allLinksByType, sentLabels, skippedLabels, status: 'ok' };
}

async function getLatestKaraokeTestEntry() {
    const feed = await parser.parseURL(RSS_URL);
    const latestItem = getLatestItem(feed.items.filter(item => item.link));

    if (!latestItem) {
        return { entries: [], skippedLabels: [], status: 'empty' };
    }

    const type = getItemType(latestItem);
    const entry = createKaraokeEntry(latestItem, type);

    return {
        entries: entry ? [entry] : [],
        skippedLabels: entry ? [] : [type.label],
        status: entry ? 'ok' : 'missing_media',
    };
}

function updateSentLinksByType(newLinksByType) {
    const existing = getSentLinksByType();
    const updated = createLinksByType();

    for (const type of ITEM_TYPES) {
        const links = newLinksByType[type.key] || [];
        updated[type.key] = [...new Set([...(existing[type.key] || []), ...links])]
            .slice(-MAX_STORED_LINKS);
    }

    setStateValue(STATE_KEY, updated);
}

async function sendKaraokeImages(client, webhookUrl, testMode = false) {
    logger.info(`[KaraokeSender] RSS 이미지 전송 시작${testMode ? ' (테스트 모드)' : ''}...`);

    let result;
    try {
        result = testMode ? await getLatestKaraokeTestEntry() : await getLatestKaraokeEntries();
    } catch (error) {
        logger.error('[KaraokeSender] RSS 파싱 중 오류:', error);
        return;
    }

    const { entries, allLinksByType, sentLabels = [], skippedLabels = [], status } = result;

    if (!entries.length) {
        if (!testMode) {
            updateSentLinksByType(allLinksByType);
        }
        if (status === 'empty') {
            logger.info('[KaraokeSender] RSS 항목이 없습니다.');
        } else if (sentLabels.length) {
            logger.info(`[KaraokeSender] 최신 항목은 이미 전송된 상태입니다: ${sentLabels.join(', ')}`);
        } else {
            logger.warn(`[KaraokeSender] 최신 항목에 이미지가 없어 전송하지 않고 처리했습니다: ${skippedLabels.join(', ')}`);
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
            await webhook.send({ embeds: entries.map(entry => entry.embed) });
            if (!testMode) {
                updateSentLinksByType(allLinksByType);
            }
            if (sentLabels.length) {
                logger.info(`[KaraokeSender] 이미 전송된 최신 항목: ${sentLabels.join(', ')}`);
            }
            if (skippedLabels.length) {
                logger.warn(`[KaraokeSender] 이미지가 없는 최신 항목을 전송 없이 처리했습니다: ${skippedLabels.join(', ')}`);
            }
            logger.info(`[KaraokeSender] 최신 이미지 ${entries.length}개 전송 완료${testMode ? ' (테스트 모드)' : ''}: ${entries.map(entry => entry.type.label).join(', ')}`);
        } else {
            logger.error(`[KaraokeSender] 지원하지 않는 SEND_MODE: ${SEND_MODE}`);
        }
    } catch (error) {
        logger.error('[KaraokeSender] 전송 중 오류:', error);
    }
}

export default { sendKaraokeImages, CRON_EXPRESSION };
