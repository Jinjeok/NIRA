import cron from 'node-cron';
import logger from './logger.js';

// 각 스케줄 작업 파일에서 설정과 함수를 가져옵니다.
import dailyNewsTask from './schedule/dailyNewsSender.js';

// 스플래툰 스케줄 작업 가져오기
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


    // --- Daily News Task ---
    if (dailyNewsTask && dailyNewsTask.CRON_EXPRESSION && dailyNewsTask.sendNews) {
        if (!cron.validate(dailyNewsTask.CRON_EXPRESSION)) {
            logger.error(`[Scheduler] DailyNewsTask의 CRON 표현식이 유효하지 않습니다: ${dailyNewsTask.CRON_EXPRESSION}`);
        } else {
            logger.info(`[Scheduler] DailyNewsTask가 CRON 표현식 '${dailyNewsTask.CRON_EXPRESSION}' (Asia/Seoul 타임존)으로 설정되었습니다.`);
            cron.schedule(dailyNewsTask.CRON_EXPRESSION, () => {
                logger.info(`[Scheduler] DailyNewsTask 실행: ${new Date().toLocaleString()}`);
                dailyNewsTask.sendNews(client);
            }, {
                scheduled: true,
                timezone: "Asia/Seoul"
            });
        }
    } else {
        logger.warn('[Scheduler] DailyNewsTask를 위한 설정(CRON_EXPRESSION) 또는 함수(sendNews)가 dailyNewsSender.js에 정의되지 않았습니다.');
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
