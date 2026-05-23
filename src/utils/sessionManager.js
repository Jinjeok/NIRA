import logger from '../logger.js';
import {
    cleanupExpiredSessionRecords,
    deleteSessionRecord,
    loadSessionRecord,
    saveSessionRecord,
} from '../storage/appStore.js';

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

export async function loadSession(userId) {
    const session = loadSessionRecord(userId);
    if (!session) return null;

    if (Date.now() - session.lastUpdate > SESSION_TIMEOUT) {
        logger.info(`[SessionManager] Session expired for user ${userId}`);
        deleteSessionRecord(userId);
        return null;
    }

    return session;
}

export async function saveSession(userId, history) {
    try {
        saveSessionRecord(userId, history);
        logger.info(`[SessionManager] Session saved for user ${userId}`);
    } catch (error) {
        logger.error(`[SessionManager] Error saving session for user ${userId}:`, error);
    }
}

export async function deleteSession(userId) {
    try {
        const deleted = deleteSessionRecord(userId);
        if (deleted) {
            logger.info(`[SessionManager] Session deleted for user ${userId}`);
        }
        return deleted;
    } catch (error) {
        logger.error(`[SessionManager] Error deleting session for user ${userId}:`, error);
        return false;
    }
}

export async function cleanupExpiredSessions() {
    try {
        const cleanedCount = cleanupExpiredSessionRecords(SESSION_TIMEOUT);
        if (cleanedCount > 0) {
            logger.info(`[SessionManager] Cleaned up ${cleanedCount} expired session(s)`);
        }
        return cleanedCount;
    } catch (error) {
        logger.error('[SessionManager] Error during cleanup:', error);
        return 0;
    }
}
