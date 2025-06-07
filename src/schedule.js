const cron = require('node-cron');
const logger = require('./logger');

// 각 스케줄 작업 파일에서 설정과 함수를 가져옵니다.
const dailyNewsTask = require('./schedule/dailyNewsSender');

// 추가적인 스케줄 작업이 있다면 여기에 import 합니다.
// const anotherScheduledTask = require('./schedule/anotherTask');

function initScheduler(client) {
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

    // --- 다른 스케줄 작업 등록 (예시) ---
    // if (anotherScheduledTask && anotherScheduledTask.CRON_EXPRESSION && anotherScheduledTask.executeTask) {
    //     if (cron.validate(anotherScheduledTask.CRON_EXPRESSION)) {
    //         logger.info(`[Scheduler] AnotherScheduledTask가 CRON 표현식 '${anotherScheduledTask.CRON_EXPRESSION}'으로 설정되었습니다.`);
    //         cron.schedule(anotherScheduledTask.CRON_EXPRESSION, () => {
    //             anotherScheduledTask.executeTask(client);
    //         }, { timezone: "Asia/Seoul" });
    //     } else {
    //         logger.error(`[Scheduler] AnotherScheduledTask의 CRON 표현식이 유효하지 않습니다: ${anotherScheduledTask.CRON_EXPRESSION}`);
    //     }
    // }
}

module.exports = { initScheduler };
