import { WebhookClient } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import logger from '../logger.js';
import { fileURLToPath } from 'node:url'; // __dirname 대체용

// ES 모듈에서 __dirname을 사용하기 위한 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { fetchNewsEmbed } from '../commands/newsletter.js'; // newsletter.js 에서 함수 가져오기

// --- Daily News Sender Configuration ---
// 이 섹션에서 이 스케줄 작업에 대한 설정을 직접 관리합니다.
const SEND_MODE = "webhook"; // "webhook" 또는 "channel"
const WEBHOOK_URL = process.env.DAILYNEWS_WEBHOOK_URL; // .env 파일에서 웹훅 URL을 읽어옵니다.
const CHANNEL_ID = "YOUR_TARGET_CHANNEL_ID_FOR_DAILY_NEWS"; // 채널 모드일 경우 사용 (필요시 .env로 이동 가능)
const NEWS_CATEGORY = '헤드라인'; // 전송할 뉴스 카테고리
const CRON_EXPRESSION = '0 9 * * *'; // 매일 오전 9시 (이 작업의 실행 주기)
// --- End of Configuration ---

const messageIdStorePath = path.join(__dirname, '..', '..', 'temp', 'messageIdStore.json'); // 저장 경로 변경

async function getMessageId(key = 'dailyNews') {
    try {
        const data = await fs.readFile(messageIdStorePath, 'utf8');
        const store = JSON.parse(data);
        return store[key];
    } catch (error) {
        if (error.code === 'ENOENT') { // 파일이 없을 경우
            logger.info(`[DailyNewsSender] Message ID store file not found at ${messageIdStorePath}. Will create one.`);
            await fs.writeFile(messageIdStorePath, JSON.stringify({}), 'utf8');
            return null;
        }
        logger.error('[DailyNewsSender] Error reading message ID store:', error);
        return null;
    }
}

async function setMessageId(id, key = 'dailyNews') {
    try {
        let store = {};
        try {
            const data = await fs.readFile(messageIdStorePath, 'utf8');
            store = JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error; // 파일 없음 외의 오류는 다시 던짐
        }
        store[key] = id;
        await fs.writeFile(messageIdStorePath, JSON.stringify(store, null, 2), 'utf8');
    } catch (error) {
        logger.error('[DailyNewsSender] Error writing message ID store:', error);
    }
}

async function sendNews(client) {
    logger.info(`[DailyNewsSender] '${NEWS_CATEGORY}' 뉴스 전송 작업 시작 (모드: ${SEND_MODE})...`);
    const newsEmbed = await fetchNewsEmbed(NEWS_CATEGORY);

    if (!newsEmbed) {
        logger.warn(`[DailyNewsSender] '${NEWS_CATEGORY}' 뉴스 Embed 생성 실패.`);
        return;
    }
    
    try {
        if (SEND_MODE === 'webhook') {
            if (!WEBHOOK_URL) {
                logger.error('[DailyNewsSender] Webhook 모드이지만 DAILYNEWS_WEBHOOK_URL 환경 변수가 설정되지 않았거나 유효하지 않습니다. 웹훅 전송을 건너<0xEB><0x9B><0x84>니다.');
                return;
            }
            const webhook = new WebhookClient({ url: WEBHOOK_URL });
            await webhook.send({ embeds: [newsEmbed] });
            logger.info(`[DailyNewsSender] Webhook으로 '${NEWS_CATEGORY}' 뉴스 전송 완료.`);
        } else if (SEND_MODE === 'channel') {
            if (!CHANNEL_ID) {
                logger.error('[DailyNewsSender] Channel 모드이지만 CHANNEL_ID가 설정되지 않았습니다.');
                return;
            }
            const channel = await client.channels.fetch(CHANNEL_ID);
            if (!channel || !channel.isTextBased()) {
                logger.error(`[DailyNewsSender] 채널 ID ${channelId}를 찾을 수 없거나 텍스트 채널이 아닙니다.`);
                return;
            }

            const messageId = await getMessageId('dailyNews'); // 명시적으로 키 전달
            if (messageId) {
                try {
                    const message = await channel.messages.fetch(messageId);
                    await message.edit({ embeds: [newsEmbed] });
                    logger.info(`[DailyNewsSender] 채널 ${CHANNEL_ID}의 메시지 ${messageId} 수정 완료.`);
                } catch (error) {
                    logger.warn(`[DailyNewsSender] 메시지 ${messageId} 수정 실패 (아마도 삭제됨), 새 메시지 전송 시도:`, error.message);
                    const newMessage = await channel.send({ embeds: [newsEmbed] });
                    await setMessageId(newMessage.id, 'dailyNews'); // 명시적으로 키 전달
                    logger.info(`[DailyNewsSender] 채널 ${CHANNEL_ID}에 새 뉴스 메시지 전송 완료 (ID: ${newMessage.id}).`);
                }
            } else {
                const newMessage = await channel.send({ embeds: [newsEmbed] });
                await setMessageId(newMessage.id, 'dailyNews'); // 명시적으로 키 전달
                logger.info(`[DailyNewsSender] 채널 ${CHANNEL_ID}에 새 뉴스 메시지 전송 완료 (ID: ${newMessage.id}).`);
            }
        } else {
            logger.error(`[DailyNewsSender] 유효하지 않은 SEND_MODE: ${SEND_MODE}`);
        }
    } catch (error) {
        logger.error(`[DailyNewsSender] 뉴스 전송 중 오류 발생:`, error);
    }
}

export default {
    sendNews,
    CRON_EXPRESSION, // 스케줄러에서 사용할 수 있도록 CRON 표현식 내보내기
};
