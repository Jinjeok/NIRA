// karaokeSender.js
import { WebhookClient } from '../discord.js';
import fs from 'fs/promises';
import path from 'path';
import Parser from 'rss-parser';
import logger from '../logger.js';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEND_MODE = "webhook";
const CHANNEL_ID = "YOUR_TARGET_CHANNEL_ID_FOR_DAILY_NEWS";
const RSS_URL = 'https://planet.moe/@karaoke_jpop.rss';
const CRON_EXPRESSION = '0 9 * * *';

const parser = new Parser({
  customFields: {
    item: [['media:content', 'media:content', { keepArray: true }]]
  }
});

async function getRecentKaraokeEmbeds() {
  try {
    const feed = await parser.parseURL(RSS_URL);
    const now = new Date();
    const yesterday9AM = new Date(now);
    yesterday9AM.setDate(now.getDate() - 1);
    yesterday9AM.setHours(9, 0, 0, 0);

    const items = feed.items.filter(i => {
      const pub = new Date(i.pubDate);
      return pub > yesterday9AM && pub <= now;
    });

    const embeds = items.map(item => {
      const media = item['media:content']?.find(m => m.$?.url);
      if (!media) return null;
      return {
        title: item.title || '🎤 노래방 신곡 알림',
        image: { url: media.$.url },
        url: item.link,
        timestamp: new Date(item.pubDate).toISOString(),
        color: 0xEE82EE,
        footer: {
            "icon_url": "https://media.planet.moe/accounts/avatars/109/797/204/938/216/927/original/4928ee70039d2c7a.jpg",
            "text": "게시일"
        },
      };
    }).filter(e => e);

    return embeds;
  } catch (error) {
    logger.error('[KaraokeSender] RSS 파싱 중 오류:', error);
    return [];
  }
}

async function sendKaraokeImages(client, webhookUrl) {
  logger.info(`[KaraokeSender] RSS 이미지 전송 시작 (모드: ${SEND_MODE})...`);
  const embeds = await getRecentKaraokeEmbeds();

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
      logger.info(`[KaraokeSender] Webhook으로 이미지 ${embeds.length}개 전송 완료.`);
    } else if (SEND_MODE === 'channel') {
      if (!CHANNEL_ID) {
        logger.error('[KaraokeSender] Channel ID가 설정되지 않았습니다.');
        return;
      }
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (!channel || !channel.isTextBased()) {
        logger.error(`[KaraokeSender] 채널 ID ${CHANNEL_ID}가 유효하지 않거나 텍스트 채널이 아닙니다.`);
        return;
      }
      await channel.send({ embeds });
      logger.info(`[KaraokeSender] 채널 ${CHANNEL_ID}에 이미지 ${embeds.length}개 전송 완료.`);
    } else {
      logger.error(`[KaraokeSender] 유효하지 않은 SEND_MODE: ${SEND_MODE}`);
    }
  } catch (error) {
    logger.error('[KaraokeSender] 이미지 전송 중 오류 발생:', error);
  }
}

export default {
  sendKaraokeImages,
  CRON_EXPRESSION
};
