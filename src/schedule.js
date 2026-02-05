import cron from 'node-cron';
import logger from './logger.js';
import splatoonTask from './schedule/splatoonSchedule.js';
import karaokeSender from './schedule/karaokeSender.js';
import { cleanupExpiredSessions } from './utils/sessionManager.js';
import { cleanupConversations } from './utils/conversationManager.js';

function initScheduler(client) {
  // karaoke image task
  if (karaokeSender?.CRON_EXPRESSION && karaokeSender?.sendKaraokeImages) {
    if (!cron.validate(karaokeSender.CRON_EXPRESSION)) {
      logger.error(`[Scheduler] karaokeSender CRON invalid: ${karaokeSender.CRON_EXPRESSION}`);
    } else {
      logger.info(`[Scheduler] karaokeSender scheduled '${karaokeSender.CRON_EXPRESSION}' (Asia/Seoul)`);
      cron.schedule(karaokeSender.CRON_EXPRESSION, () => {
        logger.info(`[Scheduler] karaokeSender tick: ${new Date().toLocaleString()}`);
        karaokeSender.sendKaraokeImages(client);
      }, { scheduled: true, timezone: 'Asia/Seoul' });
    }
  }

  // Gemini session cleanup task - 매 1시간마다 만료된 세션 정리
  const SESSION_CLEANUP_CRON = '0 * * * *'; // 매시 정각에 실행
  logger.info(`[Scheduler] Gemini Session Cleanup scheduled '${SESSION_CLEANUP_CRON}' (Asia/Seoul)`);
  cron.schedule(SESSION_CLEANUP_CRON, async () => {
    logger.info(`[Scheduler] Gemini Session Cleanup tick: ${new Date().toLocaleString()}`);
    await cleanupExpiredSessions();
  }, { scheduled: true, timezone: 'Asia/Seoul' });

  // Gemini conversation cleanup task - 매 1시간마다 만료된 대화 정리
  const CONVERSATION_CLEANUP_CRON = '0 * * * *'; // 매시 정각에 실행
  logger.info(`[Scheduler] Gemini Conversation Cleanup scheduled '${CONVERSATION_CLEANUP_CRON}' (Asia/Seoul)`);
  cron.schedule(CONVERSATION_CLEANUP_CRON, async () => {
    logger.info(`[Scheduler] Gemini Conversation Cleanup tick: ${new Date().toLocaleString()}`);
    await cleanupConversations();
  }, { scheduled: true, timezone: 'Asia/Seoul' });

  // Splatoon task
  if (splatoonTask?.CRON_EXPRESSION && splatoonTask?.sendSplatoonSchedule) {
    if (!cron.validate(splatoonTask.CRON_EXPRESSION)) {
      logger.error(`[Scheduler] SplatoonTask CRON invalid: ${splatoonTask.CRON_EXPRESSION}`);
    } else {
      logger.info(`[Scheduler] SplatoonTask scheduled '${splatoonTask.CRON_EXPRESSION}' (Asia/Seoul)`);
      splatoonTask.sendSplatoonSchedule(client);
      cron.schedule(splatoonTask.CRON_EXPRESSION, () => {
        logger.info(`[Scheduler] SplatoonTask tick: ${new Date().toLocaleString()}`);
        splatoonTask.sendSplatoonSchedule(client);
      }, { scheduled: true, timezone: 'Asia/Seoul' });
    }
  }
}

export default { initScheduler };