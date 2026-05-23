import fs from 'node:fs/promises';
import path from 'node:path';
import logger from '../logger.js';
import {
    getSetting,
    ensureDefaultSettings,
    setSetting,
    saveConversationRecord,
    saveSessionRecord,
    setStateValue,
    setUsageCount,
} from './appStore.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const TEMP_DIR = path.join(process.cwd(), 'temp');

async function readJson(filePath) {
    try {
        return JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch (error) {
        if (error.code !== 'ENOENT') {
            logger.warn(`[Migration] Failed to read ${filePath}: ${error.message}`);
        }
        return null;
    }
}

async function migrateSessions() {
    const sessionsDir = path.join(DATA_DIR, 'gemini-sessions');
    let migrated = 0;

    try {
        const files = await fs.readdir(sessionsDir);
        for (const file of files) {
            if (!file.endsWith('.json')) continue;

            const sessionKey = file.slice(0, -'.json'.length);
            const data = await readJson(path.join(sessionsDir, file));
            if (!data || !Array.isArray(data.history)) continue;

            saveSessionRecord(sessionKey, data.history, data.createdAt);
            migrated++;
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            logger.warn(`[Migration] Session migration skipped: ${error.message}`);
        }
    }

    return migrated;
}

async function migrateConversations() {
    const conversationsDir = path.join(DATA_DIR, 'conversation');
    let migrated = 0;

    try {
        const files = await fs.readdir(conversationsDir);
        for (const file of files) {
            if (!file.endsWith('.json')) continue;

            const interactionId = file.slice(0, -'.json'.length);
            const data = await readJson(path.join(conversationsDir, file));
            if (!data) continue;

            saveConversationRecord(interactionId, data);
            migrated++;
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            logger.warn(`[Migration] Conversation migration skipped: ${error.message}`);
        }
    }

    return migrated;
}

async function migrateUsage() {
    const usage = await readJson(path.join(DATA_DIR, 'usage.json'));
    if (!usage?.date || !usage.counts || typeof usage.counts !== 'object') {
        return 0;
    }

    let migrated = 0;
    for (const [model, count] of Object.entries(usage.counts)) {
        setUsageCount(model, usage.date, Number(count || 0));
        migrated++;
    }

    return migrated;
}

async function migrateMessageIds() {
    const store = await readJson(path.join(TEMP_DIR, 'messageIdStore.json'));
    if (!store || typeof store !== 'object') {
        return 0;
    }

    let migrated = 0;
    for (const [key, value] of Object.entries(store)) {
        setStateValue(`messageId:${key}`, value);
        migrated++;
    }

    return migrated;
}

export async function migrateLocalState({ force = false } = {}) {
    ensureDefaultSettings();

    if (!force && getSetting('local_state_migrated_at')) {
        return { skipped: true };
    }

    const result = {
        skipped: false,
        sessions: await migrateSessions(),
        conversations: await migrateConversations(),
        usageCounters: await migrateUsage(),
        messageIds: await migrateMessageIds(),
    };

    setSetting('local_state_migrated_at', new Date().toISOString());
    logger.info(`[Migration] Local state migrated: ${JSON.stringify(result)}`);
    return result;
}
