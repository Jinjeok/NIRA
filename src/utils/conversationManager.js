import logger from '../logger.js';
import {
    cleanupExpiredConversationRecords,
    deleteConversationRecord,
    loadConversationRecord,
    saveConversationRecord,
} from '../storage/appStore.js';

const CONVERSATION_TIMEOUT = 24 * 60 * 60 * 1000;

export async function saveConversation(interactionId, data) {
    try {
        saveConversationRecord(interactionId, data);
    } catch (error) {
        logger.error(`[ConversationManager] Failed to save conversation: ${error.message}`);
    }
}

export async function loadConversation(interactionId) {
    try {
        return loadConversationRecord(interactionId);
    } catch (error) {
        logger.error(`[ConversationManager] Failed to load conversation: ${error.message}`);
        return null;
    }
}

export async function deleteConversation(interactionId) {
    try {
        const deleted = deleteConversationRecord(interactionId);
        if (deleted) {
            logger.info(`[ConversationManager] Deleted conversation for ${interactionId}`);
        }
        return deleted;
    } catch (error) {
        logger.error(`[ConversationManager] Failed to delete conversation: ${error.message}`);
        return false;
    }
}

export async function cleanupConversations() {
    logger.info('[ConversationManager] Starting cleanup...');
    try {
        const deletedCount = cleanupExpiredConversationRecords(CONVERSATION_TIMEOUT);
        if (deletedCount > 0) {
            logger.info(`[ConversationManager] Cleanup complete. Deleted ${deletedCount} old conversations.`);
        }
        return deletedCount;
    } catch (error) {
        logger.error(`[ConversationManager] Cleanup failed: ${error.message}`);
        return 0;
    }
}
