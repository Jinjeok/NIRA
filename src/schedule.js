import cron from 'node-cron';
import logger from './logger.js';
import { runtimeLabel } from './runtime/codenames.js';
import splatoonTask from './schedule/splatoonSchedule.js';
import karaokeSender from './schedule/karaokeSender.js';
import dailyNewsSender from './schedule/dailyNewsSender.js';
import tenseijingo from './schedule/tenseijingo.js';
import { cleanupExpiredSessions } from './utils/sessionManager.js';
import { cleanupConversations } from './utils/conversationManager.js';
import {
    deleteOldCommandExecutionLogs,
    deleteOldSchedulerRunLogs,
    ensureSchedulerJob,
    getSchedulerJob,
    listSchedulerJobs,
    recordSchedulerRun,
    updateSchedulerJob,
} from './storage/appStore.js';

const SCHEDULER_LABEL = `Scheduler:${runtimeLabel('scheduler')}`;

function createJobDefinitions(client) {
    return [
        {
            jobId: 'karaoke_sender',
            handlerKey: 'karaoke_sender',
            cronExpression: karaokeSender.CRON_EXPRESSION,
            timezone: 'Asia/Seoul',
            enabled: true,
            targetType: 'webhook',
            webhookUrl: process.env.KARAOKE_WEBHOOK_URL || null,
            run: (trigger) => {
                const job = getSchedulerJob('karaoke_sender');
                return karaokeSender.sendKaraokeImages(client, job?.webhookUrl, trigger === 'admin');
            },
        },
        {
            jobId: 'daily_news_sender',
            handlerKey: 'daily_news_sender',
            cronExpression: dailyNewsSender.CRON_EXPRESSION,
            timezone: 'Asia/Seoul',
            enabled: false,
            targetType: 'webhook',
            webhookUrl: process.env.DAILYNEWS_WEBHOOK_URL || null,
            run: () => {
                const job = getSchedulerJob('daily_news_sender');
                return dailyNewsSender.sendNews(client, job?.webhookUrl);
            },
        },
        {
            jobId: 'gemini_session_cleanup',
            handlerKey: 'cleanup_expired_sessions',
            cronExpression: '0 * * * *',
            timezone: 'Asia/Seoul',
            enabled: true,
            targetType: 'internal',
            run: () => cleanupExpiredSessions(),
        },
        {
            jobId: 'gemini_conversation_cleanup',
            handlerKey: 'cleanup_conversations',
            cronExpression: '0 * * * *',
            timezone: 'Asia/Seoul',
            enabled: true,
            targetType: 'internal',
            run: () => cleanupConversations(),
        },
        {
            jobId: 'retention_cleanup',
            handlerKey: 'retention_cleanup',
            cronExpression: '10 3 * * *',
            timezone: 'Asia/Seoul',
            enabled: true,
            targetType: 'internal',
            run: () => {
                const commandLogs = deleteOldCommandExecutionLogs();
                const schedulerLogs = deleteOldSchedulerRunLogs();
                logger.info(`[${SCHEDULER_LABEL}] Retention cleanup deleted commandLogs=${commandLogs}, schedulerLogs=${schedulerLogs}`);
            },
        },
        {
            jobId: 'splatoon_schedule',
            handlerKey: 'splatoon_schedule',
            cronExpression: splatoonTask.CRON_EXPRESSION,
            timezone: 'Asia/Seoul',
            enabled: true,
            targetType: 'channel',
            webhookUrl: process.env.SPLATOON_SCHEDULE_CHANNEL_ID || null,
            run: (trigger) => {
                const job = getSchedulerJob('splatoon_schedule');
                return splatoonTask.sendSplatoonSchedule(client, job?.webhookUrl);
            },
            runOnStart: true,
        },
        {
            jobId: 'tenseijingo',
            handlerKey: 'tenseijingo',
            cronExpression: tenseijingo.CRON_EXPRESSION,
            timezone: 'Asia/Seoul',
            enabled: true,
            targetType: 'webhook',
            webhookUrl: process.env.TENSEIJINGO_WEBHOOK_URL || null,
            run: (trigger) => {
                const job = getSchedulerJob('tenseijingo');
                return tenseijingo.sendTenseijingo(client, job?.webhookUrl, trigger === 'admin');
            },
        },
    ];
}

function createController(client) {
    const definitions = createJobDefinitions(client);
    const definitionById = new Map(definitions.map((job) => [job.jobId, job]));
    const tasks = new Map();
    const inProgress = new Set();

    async function runJob(jobId, trigger = 'manual') {
        const definition = definitionById.get(jobId);
        if (!definition) {
            throw new Error(`Unknown scheduler job: ${jobId}`);
        }

        if (inProgress.has(jobId)) {
            logger.warn(`[${SCHEDULER_LABEL}] ${jobId} skipped because a previous run is still in progress`);
            return { skipped: true };
        }

        const startedAt = Date.now();
        inProgress.add(jobId);
        logger.info(`[${SCHEDULER_LABEL}] ${jobId} tick (${trigger})`);

        try {
            await definition.run(trigger);
            const durationMs = Date.now() - startedAt;
            recordSchedulerRun(jobId, 'success', durationMs);
            return { skipped: false, status: 'success', durationMs };
        } catch (error) {
            const durationMs = Date.now() - startedAt;
            logger.error(`[${SCHEDULER_LABEL}] ${jobId} failed:`, error);
            recordSchedulerRun(jobId, 'error', durationMs, error.message);
            return { skipped: false, status: 'error', durationMs, error: error.message };
        } finally {
            inProgress.delete(jobId);
        }
    }

    function stopAll() {
        for (const task of tasks.values()) {
            task.stop();
        }
        tasks.clear();
    }

    function startAll() {
        stopAll();

        for (const definition of definitions) {
            ensureSchedulerJob(definition);
        }

        for (const job of listSchedulerJobs()) {
            const definition = definitionById.get(job.jobId);
            if (!definition || !job.enabled) continue;

            if (!cron.validate(job.cronExpression)) {
                logger.error(`[${SCHEDULER_LABEL}] ${job.jobId} CRON invalid: ${job.cronExpression}`);
                continue;
            }

            logger.info(`[${SCHEDULER_LABEL}] ${job.jobId} scheduled '${job.cronExpression}' (${job.timezone})`);
            const task = cron.schedule(
                job.cronExpression,
                () => runJob(job.jobId, 'cron'),
                { scheduled: true, timezone: job.timezone },
            );
            tasks.set(job.jobId, task);

            if (definition.runOnStart) {
                runJob(job.jobId, 'startup');
            }
        }
    }

    function updateJob(jobId, patch) {
        if (patch.cronExpression && !cron.validate(patch.cronExpression)) {
            throw new Error(`Invalid cron expression: ${patch.cronExpression}`);
        }

        const updated = updateSchedulerJob(jobId, patch);
        if (!updated) {
            throw new Error(`Unknown scheduler job: ${jobId}`);
        }

        startAll();
        return updated;
    }

    function getJobs() {
        return listSchedulerJobs().map((job) => ({
            ...job,
            running: inProgress.has(job.jobId),
            active: tasks.has(job.jobId),
        }));
    }

    return {
        startAll,
        stopAll,
        runJob,
        updateJob,
        getJobs,
    };
}

function initScheduler(client) {
    const controller = createController(client);
    logger.info(`[${SCHEDULER_LABEL}] scheduler runtime starting`);
    controller.startAll();
    return controller;
}

export default { initScheduler };
