import 'dotenv/config';
import logger from '../src/logger.js';
import { migrateLocalState } from '../src/storage/migrateLocalState.js';

const force = process.argv.includes('--force');

try {
    const result = await migrateLocalState({ force });
    logger.info(`[Migration] Done: ${JSON.stringify(result)}`);
} catch (error) {
    logger.error('[Migration] Failed:', error);
    process.exit(1);
}
