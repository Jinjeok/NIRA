import { WebhookClient } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import logger from '../logger.js';
import { fileURLToPath } from 'node:url';
import { fetchHotdealEmbed } from '../commands/hotdeal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Daily Hotdeal Sender Configuration (PPOMPPU RSS) ---
const SEND_MODE = process.env.HOTDEAL_SEND_MODE || 'webhook'; // 'webhook' | 'channel'
const WEBHOOK_URL = process.env.HOTDEAL_WEBHOOK_URL || process.env.DAILYNEWS_WEBHOOK_URL; // 기존 변수 호환
const CHANNEL_ID = process.env.HOTDEAL_CHANNEL_ID || '';
// RSS는 안정적이므로 빈도 소폭 상향. 지터 포함해 충돌 완화 권장.
const CRON_EXPRESSION = process.env.HOTDEAL_CRON || '0 9,15,21 * * *'; // 기본: 하루 3회
// --- End of Configuration ---

const storePath = path.join(__dirname, '..', '..', 'temp', 'messageIdStore.json');

async function readStore() {
  try {
    const data = await fs.readFile(storePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    if (e.code === 'ENOENT') {
      await fs.mkdir(path.dirname(storePath), { recursive: true });
      await fs.writeFile(storePath, JSON.stringify({}), 'utf8');
      return {};
    }
    throw e;
  }
}

async function getMessageId(key = 'dailyHotdeal') {
  try {
    const store = await readStore();
    return store[key] || null;
  } catch (error) {
    logger.error('[DailyHotdealSender] read error:', error);
    return null;
  }
}

async function setMessageId(id, key = 'dailyHotdeal') {
  try {
    const store = await readStore();
    store[key] = id;
    await fs.writeFile(storePath, JSON.stringify(store, null, 2), 'utf8');
  } catch (error) {
    logger.error('[DailyHotdealSender] write error:', error);
  }
}

async function sendHotdeal(client) {
  logger.info(`[DailyHotdealSender] 뽐뿌 RSS 핫딜 전송 시작 (mode=${SEND_MODE})`);
  const embed = await fetchHotdealEmbed();
  if (!embed) {
    logger.warn('[DailyHotdealSender] Embed 생성 실패. 중단');
    return;
  }

  try {
    if (SEND_MODE === 'webhook') {
      if (!WEBHOOK_URL) {
        logger.error('[DailyHotdealSender] WEBHOOK_URL 미설정. 전송 불가');
        return;
      }
      const webhook = new WebhookClient({ url: WEBHOOK_URL });
      await webhook.send({ embeds: [embed] });
      logger.info('[DailyHotdealSender] Webhook 전송 완료');
    } else if (SEND_MODE === 'channel') {
      if (!CHANNEL_ID) {
        logger.error('[DailyHotdealSender] CHANNEL_ID 미설정. 전송 불가');
        return;
      }
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (!channel || !channel.isTextBased()) {
        logger.error(`[DailyHotdealSender] 채널 ${CHANNEL_ID} 접근 실패`);
        return;
      }
      const prevId = await getMessageId('dailyHotdeal');
      if (prevId) {
        try {
          const msg = await channel.messages.fetch(prevId);
          await msg.edit({ embeds: [embed] });
          logger.info(`[DailyHotdealSender] 기존 메시지(${prevId}) 갱신 완료`);
          return;
        } catch (e) {
          logger.warn(`[DailyHotdealSender] 기존 메시지 수정 실패, 새로 전송: ${e.message}`);
        }
      }
      const newMsg = await channel.send({ embeds: [embed] });
      await setMessageId(newMsg.id, 'dailyHotdeal');
      logger.info(`[DailyHotdealSender] 새 메시지 전송 완료 (id=${newMsg.id})`);
    } else {
      logger.error(`[DailyHotdealSender] Unknown SEND_MODE: ${SEND_MODE}`);
    }
  } catch (error) {
    logger.error('[DailyHotdealSender] 전송 중 오류:', error);
  }
}

export default {
  sendHotdeal,
  CRON_EXPRESSION,
};