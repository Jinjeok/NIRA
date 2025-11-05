import { WebhookClient } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import logger from '../logger.js';
import { fileURLToPath } from 'node:url';
import { fetchHotdealEmbed } from '../commands/hotdeal.js';

// ES 모듈에서 __dirname을 사용하기 위한 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Daily Hotdeal Sender Configuration ---
const SEND_MODE = "webhook"; // "webhook" 또는 "channel"
const WEBHOOK_URL = process.env.DAILYNEWS_WEBHOOK_URL; // 기존 웹훅 URL 재사용
const CHANNEL_ID = "YOUR_TARGET_CHANNEL_ID_FOR_DAILY_HOTDEAL";
const CRON_EXPRESSION = '0 9,15,21 * * *'; // 매일 9시, 15시, 21시 (하루 3번)
// --- End of Configuration ---

const messageIdStorePath = path.join(__dirname, '..', '..', 'temp', 'messageIdStore.json');

async function getMessageId(key = 'dailyHotdeal') {
    try {
        const data = await fs.readFile(messageIdStorePath, 'utf8');
        const store = JSON.parse(data);
        return store[key];
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.info(`[DailyHotdealSender] Message ID store file not found at ${messageIdStorePath}. Will create one.`);
            await fs.writeFile(messageIdStorePath, JSON.stringify({}), 'utf8');
            return null;
        }
        logger.error('[DailyHotdealSender] Error reading message ID store:', error);
        return null;
    }
}

async function setMessageId(id, key = 'dailyHotdeal') {
    try {
        let store = {};
        try {
            const data = await fs.readFile(messageIdStorePath, 'utf8');
            store = JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
        store[key] = id;
        await fs.writeFile(messageIdStorePath, JSON.stringify(store, null, 2), 'utf8');
    } catch (error) {
        logger.error('[DailyHotdealSender] Error writing message ID store:', error);
    }
}

async function sendHotdeal(client) {
    logger.info(`[DailyHotdealSender] 에펨코리아 핫딜 전송 작업 시작 (모드: ${SEND_MODE})...`);
    const hotdealEmbed = await fetchHotdealEmbed();

    if (!hotdealEmbed) {
        logger.warn('[DailyHotdealSender] 핫딜 Embed 생성 실패.');
        return;
    }
    
    try {
        if (SEND_MODE === 'webhook') {
            if (!WEBHOOK_URL) {
                logger.error('[DailyHotdealSender] Webhook 모드이지만 DAILYNEWS_WEBHOOK_URL 환경 변수가 설정되지 않았거나 유효하지 않습니다. 웹훅 전송을 건너뛁니다.');
                return;
            }
            const webhook = new WebhookClient({ url: WEBHOOK_URL });
            await webhook.send({ embeds: [hotdealEmbed] });
            logger.info('[DailyHotdealSender] Webhook으로 에펨코리아 핫딜 전송 완료.');
        } else if (SEND_MODE === 'channel') {
            if (!CHANNEL_ID) {
                logger.error('[DailyHotdealSender] Channel 모드이지만 CHANNEL_ID가 설정되지 않았습니다.');
                return;
            }
            const channel = await client.channels.fetch(CHANNEL_ID);
            if (!channel || !channel.isTextBased()) {
                logger.error(`[DailyHotdealSender] 채널 ID ${CHANNEL_ID}를 찾을 수 없거나 텍스트 채널이 아닙니다.`);
                return;
            }

            const messageId = await getMessageId('dailyHotdeal');
            if (messageId) {
                try {
                    const message = await channel.messages.fetch(messageId);
                    await message.edit({ embeds: [hotdealEmbed] });
                    logger.info(`[DailyHotdealSender] 채널 ${CHANNEL_ID}의 메시지 ${messageId} 수정 완료.`);
                } catch (error) {
                    logger.warn(`[DailyHotdealSender] 메시지 ${messageId} 수정 실패 (아마도 삭제됨), 새 메시지 전송 시도:`, error.message);
                    const newMessage = await channel.send({ embeds: [hotdealEmbed] });
                    await setMessageId(newMessage.id, 'dailyHotdeal');
                    logger.info(`[DailyHotdealSender] 채널 ${CHANNEL_ID}에 새 핫딜 메시지 전송 완료 (ID: ${newMessage.id}).`);
                }
            } else {
                const newMessage = await channel.send({ embeds: [hotdealEmbed] });
                await setMessageId(newMessage.id, 'dailyHotdeal');
                logger.info(`[DailyHotdealSender] 채널 ${CHANNEL_ID}에 새 핫딜 메시지 전송 완료 (ID: ${newMessage.id}).`);
            }
        } else {
            logger.error(`[DailyHotdealSender] 유효하지 않은 SEND_MODE: ${SEND_MODE}`);
        }
    } catch (error) {
        logger.error('[DailyHotdealSender] 에펨코리아 핫딜 전송 중 오류 발생:', error);
    }
}

export default {
    sendHotdeal,
    CRON_EXPRESSION,
};