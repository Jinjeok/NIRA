import 'dotenv/config';
import logger from '../logger.js';
import { startAdminServer } from '../admin/server.js';
import { startBot } from '../../index.js';
import { runtimeLabel } from './codenames.js';

const enableScheduler = process.env.SCHEDULER_ENABLED !== 'false';
const enableAdmin = process.env.ADMIN_ENABLED !== 'false';

try {
    const botRuntime = await startBot({ enableScheduler });

    if (enableAdmin) {
        startAdminServer(botRuntime.runtime);
    }

    await botRuntime.ready;
    logger.info(`[Runtime] NIRA started. bot=${runtimeLabel('bot')}, scheduler=${enableScheduler ? runtimeLabel('scheduler') : 'disabled'}, admin=${enableAdmin ? runtimeLabel('admin') : 'disabled'}`);
} catch (error) {
    logger.error('[Runtime] Failed to start NIRA:', error);
    process.exit(1);
}
