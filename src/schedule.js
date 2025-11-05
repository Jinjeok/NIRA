import cron from 'node-cron';
import logger from './logger.js';

// 핫딜 스케줄 작업 가져오기
import dailyHotdealTask from './schedule/dailyHotdealSender.js';

// 스플래튤 스케줄 작업 가져오기
import splatoonTask from './schedule/splatoonSchedule.js';

import karaokeSender from './schedule/karaokeSender.js'; // rss 이미지 전송 작업 가져오기

function initScheduler(client) {

    // --- RSS Image Task ---
    if (karaokeSender && karaokeSender.CRON_EXPRESSION && karaokeSender.sendKaraokeImages) {
        if (!cron.validate(karaokeSender.CRON_EXPRESSION)) {
            logger.error(`[Scheduler] karaokeSender의 CRON 표현식이 유효하지 않습니다: ${karaokeSender.CRON_EXPRESSION}`);
        } else {
            logger.info(`[Scheduler] karaokeSender가 CRON 표현식 '${karaokeSender.CRON_EXPRESSION}' (Asia/Seoul 타임존)으로 설정되었습니다.`);
            cron.schedule(karaokeSender.CRON_EXPRESSION, () => {
                logger.info(`[Scheduler] karaokeSender 실행: ${new Date().toLocaleString()}`);
                karaokeSender.sendKaraokeImages(client);
            }, {
                scheduled: true,
                timezone: "Asia/Seoul"
            });
        }
    } else {
        logger.warn('[Scheduler] karaokeSender를 위한 설정(CRON_EXPRESSION) 또는 함수(sendRssImage)가 rssImageSender.js에 정의되지 않았습니다.');
    }

    // --- Daily Hotdeal Task (기존 Daily News Task 대체) ---
    if (dailyHotdealTask && dailyHotdealTask.CRON_EXPRESSION && dailyHotdealTask.sendHotdeal) {
        if (!cron.validate(dailyHotdealTask.CRON_EXPRESSION)) {
            logger.error(`[Scheduler] DailyHotdealTask의 CRON 표현식이 유효하지 않습니다: ${dailyHotdealTask.CRON_EXPRESSION}`);
        } else {
            logger.info(`[Scheduler] DailyHotdealTask가 CRON 표현식 '${dailyHotdealTask.CRON_EXPRESSION}' (Asia/Seoul 타임존)으로 설정되었습니다.`);
            cron.schedule(dailyHotdealTask.CRON_EXPRESSION, () => {
                logger.info(`[Scheduler] DailyHotdealTask 실행: ${new Date().toLocaleString()}`);
                dailyHotdealTask.sendHotdeal(client);
            }, {
                scheduled: true,
                timezone: "Asia/Seoul"
            });
        }
    } else {
        logger.warn('[Scheduler] DailyHotdealTask를 위한 설정(CRON_EXPRESSION) 또는 함수(sendHotdeal)가 dailyHotdealSender.js에 정의되지 않았습니다.');
    }

    // --- Splatoon Schedule Task ---
    if (splatoonTask && splatoonTask.CRON_EXPRESSION && splatoonTask.sendSplatoonSchedule) {
        if (!cron.validate(splatoonTask.CRON_EXPRESSION)) {
            logger.error(`[Scheduler] SplatoonTask의 CRON 표현식이 유효하지 않습니다: ${splatoonTask.CRON_EXPRESSION}`);
        } else {
            logger.info(`[Scheduler] SplatoonTask가 CRON 표현식 '${splatoonTask.CRON_EXPRESSION}' (Asia/Seoul 타임존)으로 설정되었습니다.`);
            // 봇이 준비된 후 첫 실행은 즉시, 그 후로는 스케줄에 따라 실행
            splatoonTask.sendSplatoonSchedule(client); // 초기 실행
            cron.schedule(splatoonTask.CRON_EXPRESSION, () => {
                logger.info(`[Scheduler] SplatoonTask 실행: ${new Date().toLocaleString()}`);
                splatoonTask.sendSplatoonSchedule(client);
            }, {
                scheduled: true,
                timezone: "Asia/Seoul"
            });
        }
    } else {
        logger.warn('[Scheduler] SplatoonTask를 위한 설정(CRON_EXPRESSION) 또는 함수(sendSplatoonSchedule)가 splatoonSchedule.js에 정의되지 않았습니다.');
    }
}

export default { initScheduler };