import { WebhookClient } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import logger from '../logger.js';
import { fileURLToPath } from 'node:url';
import { fetchHotdealEmbed } from '../commands/hotdeal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEND_MODE = process.env.HOTDEAL_SEND_MODE || 'channel'; // 편집 운영에 channel 권장
const WEBHOOK_URL = process.env.HOTDEAL_WEBHOOK_URL || process.env.DAILYNEWS_WEBHOOK_URL;
const CHANNEL_ID = process.env.HOTDEAL_CHANNEL_ID || '';

const storePath = path.join(__dirname, '..', '..', 'temp', 'messageIdStore.json');

async function ensureStore() {
  try { await fs.mkdir(path.dirname(storePath), { recursive: true }); } catch {}
  try { await fs.access(storePath); } catch { await fs.writeFile(storePath, JSON.stringify({}), 'utf8'); }
}
async function readStore() { await ensureStore(); return JSON.parse(await fs.readFile(storePath, 'utf8')); }
async function writeStore(obj) { await ensureStore(); await fs.writeFile(storePath, JSON.stringify(obj, null, 2), 'utf8'); }

async function getIds() {
  try { const s = await readStore(); return { initial: s['dailyHotdeal.initial'] || null, current: s['dailyHotdeal.current'] || null }; }
  catch (e) { logger.error('[DailyHotdealSender] store read error:', e); return { initial: null, current: null }; }
}
async function setIds(ids) {
  try { const s = await readStore(); if (ids.initial !== undefined) s['dailyHotdeal.initial'] = ids.initial; if (ids.current !== undefined) s['dailyHotdeal.current'] = ids.current; await writeStore(s); }
  catch (e) { logger.error('[DailyHotdealSender] store write error:', e); }
}

async function sendOrEditChannel(client, { mode }) {
  if (!CHANNEL_ID) { logger.error('[DailyHotdealSender] CHANNEL_ID 미설정'); return; }
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel || !channel.isTextBased()) { logger.error(`[DailyHotdealSender] 채널 접근 실패: ${CHANNEL_ID}`); return; }

  const embed = await fetchHotdealEmbed();
  const ids = await getIds();

  if (mode === 'send') {
    try {
      const msg = await channel.send({ embeds: [embed] });
      await setIds({ initial: msg.id, current: msg.id });
      logger.info(`[DailyHotdealSender] 09:00 신규 메시지 전송 완료 id=${msg.id}`);
    } catch (e) {
      logger.error('[DailyHotdealSender] 초기 전송 실패:', e);
    }
    return;
  }

  // edit mode
  const targetId = ids.current || ids.initial;
  if (!targetId) {
    logger.warn('[DailyHotdealSender] 편집 대상 메시지 없음 → 신규 전송');
    const msg = await channel.send({ embeds: [embed] });
    await setIds({ initial: msg.id, current: msg.id });
    return;
  }
  try {
    const msg = await channel.messages.fetch(targetId);
    await msg.edit({ embeds: [embed] });
    logger.info(`[DailyHotdealSender] 메시지 편집 완료 id=${targetId}`);
  } catch (e) {
    logger.warn(`[DailyHotdealSender] 기존 메시지 편집 실패 → 신규 전송: ${e.message}`);
    const msg = await channel.send({ embeds: [embed] });
    await setIds({ current: msg.id });
  }
}

async function sendOrEditWebhook({ mode }) {
  if (!WEBHOOK_URL) { logger.error('[DailyHotdealSender] WEBHOOK_URL 미설정'); return; }
  const webhook = new WebhookClient({ url: WEBHOOK_URL });
  const embed = await fetchHotdealEmbed();
  try {
    // 다수 웹훅 환경에서 편집 추적이 어려워, 웹훅 모드는 항상 전송 권장
    await webhook.send({ embeds: [embed] });
    logger.info('[DailyHotdealSender] Webhook 전송 완료');
  } catch (e) {
    logger.error('[DailyHotdealSender] Webhook 전송 실패:', e);
  }
}

async function sendHotdeal(client, { mode } = { mode: 'send' }) {
  // mode: 'send' (09:00 신규 전송), 'edit' (정시 갱신)
  logger.info(`[DailyHotdealSender] run mode=${mode}`);
  if (SEND_MODE === 'channel') return sendOrEditChannel(client, { mode });
  if (SEND_MODE === 'webhook') return sendOrEditWebhook({ mode });
  logger.error(`[DailyHotdealSender] Unknown SEND_MODE=${SEND_MODE}`);
}

const CRON_EXPRESSION = process.env.HOTDEAL_CRON || '0 9,15,21 * * *'; // legacy (unused by split schedule, kept for compat)

export default { sendHotdeal, CRON_EXPRESSION };