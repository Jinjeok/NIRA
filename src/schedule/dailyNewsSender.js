import { WebhookClient } from '../discord.js';
import { getMessageId as getStoredMessageId, setMessageId as setStoredMessageId } from '../utils/messageIdStore.js';
import logger from '../logger.js';
import { fetchNewsEmbed } from '../commands/newsletter.js'; // newsletter.js 에서 함수 가져오기

// --- Daily News Sender Configuration ---
// 이 섹션에서 이 스케줄 작업에 대한 설정을 직접 관리합니다.
const SEND_MODE = "webhook"; // "webhook" 또는 "channel"
const CHANNEL_ID = "YOUR_TARGET_CHANNEL_ID_FOR_DAILY_NEWS"; // 채널 모드일 경우 사용 (필요시 .env로 이동 가능)
const NEWS_CATEGORY = '헤드라인'; // 전송할 뉴스 카테고리
const CRON_EXPRESSION = '0 9 * * *'; // 매일 오전 9시 (이 작업의 실행 주기)
// --- End of Configuration ---

async function getMessageId(key = 'dailyNews') {
    return getStoredMessageId(key);
}

async function setMessageId(id, key = 'dailyNews') {
    await setStoredMessageId(key, id);
}

async function sendNews(client, webhookUrl) {
    logger.info(`[DailyNewsSender] '${NEWS_CATEGORY}' 뉴스 전송 작업 시작 (모드: ${SEND_MODE})...`);
    const newsEmbed = await fetchNewsEmbed(NEWS_CATEGORY);

    if (!newsEmbed) {
        logger.warn(`[DailyNewsSender] '${NEWS_CATEGORY}' 뉴스 Embed 생성 실패.`);
        return;
    }
    
    try {
        if (SEND_MODE === 'webhook') {
            if (!webhookUrl) {
                logger.error('[DailyNewsSender] 웹훅 URL이 설정되지 않았습니다. 어드민 페이지에서 설정해주세요.');
                return;
            }
            const webhook = new WebhookClient({ url: webhookUrl });
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
