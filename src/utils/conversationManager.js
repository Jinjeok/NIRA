import fs from 'fs/promises';
import path from 'path';
import cron from 'node-cron';
import logger from '../logger.js';

const CONVERSATION_DIR = path.join(process.cwd(), 'data', 'conversation');

// Ensure directory exists
(async () => {
    try {
        await fs.mkdir(CONVERSATION_DIR, { recursive: true });
    } catch (error) {
        logger.error(`[ConversationManager] Failed to create directory: ${error.message}`);
    }
})();

export async function saveConversation(interactionId, data) {
    try {
        const filePath = path.join(CONVERSATION_DIR, `${interactionId}.json`);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        // logger.info(`[ConversationManager] Saved conversation for ${interactionId}`);
    } catch (error) {
        logger.error(`[ConversationManager] Failed to save conversation: ${error.message}`);
    }
}

export async function loadConversation(interactionId) {
    try {
        const filePath = path.join(CONVERSATION_DIR, `${interactionId}.json`);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            logger.error(`[ConversationManager] Failed to load conversation: ${error.message}`);
        }
        return null;
    }
}

export async function deleteConversation(interactionId) {
    try {
        const filePath = path.join(CONVERSATION_DIR, `${interactionId}.json`);
        await fs.unlink(filePath);
        logger.info(`[ConversationManager] Deleted conversation for ${interactionId}`);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            logger.error(`[ConversationManager] Failed to delete conversation: ${error.message}`);
        }
    }
}

export async function cleanupConversations() {
    logger.info('[ConversationManager] Starting cleanup...');
    try {
        const files = await fs.readdir(CONVERSATION_DIR);
        const now = Date.now();
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        let deletedCount = 0;

        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            const filePath = path.join(CONVERSATION_DIR, file);
            const stats = await fs.stat(filePath);
            
            if (now - stats.mtimeMs > ONE_DAY_MS) {
                await fs.unlink(filePath);
                deletedCount++;
            }
        }
        if (deletedCount > 0) {
            logger.info(`[ConversationManager] Cleanup complete. Deleted ${deletedCount} old conversations.`);
        }
    } catch (error) {
        logger.error(`[ConversationManager] Cleanup failed: ${error.message}`);
    }
}
