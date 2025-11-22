import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'node:url';
import logger from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSIONS_DIR = path.join(__dirname, '..', '..', 'data', 'gemini-sessions');
const SESSION_TIMEOUT = 60 * 60 * 1000; // 1시간 (밀리초)

// 세션 디렉토리 초기화
async function initSessionsDir() {
    try {
        await fs.access(SESSIONS_DIR);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(SESSIONS_DIR, { recursive: true });
            logger.info(`[SessionManager] Sessions directory created at ${SESSIONS_DIR}`);
        } else {
            throw error;
        }
    }
}

// 사용자 세션 파일 경로 가져오기
function getSessionFilePath(userId) {
    return path.join(SESSIONS_DIR, `${userId}.json`);
}

// 세션 로드
export async function loadSession(userId) {
    await initSessionsDir();
    const filePath = getSessionFilePath(userId);
    
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const session = JSON.parse(data);
        
        // 세션 만료 확인
        const now = Date.now();
        if (now - session.lastUpdate > SESSION_TIMEOUT) {
            logger.info(`[SessionManager] Session expired for user ${userId}`);
            await deleteSession(userId);
            return null;
        }
        
        return session;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null; // 세션이 없음
        }
        logger.error(`[SessionManager] Error loading session for user ${userId}:`, error);
        return null;
    }
}

// 세션 저장
export async function saveSession(userId, history) {
    await initSessionsDir();
    const filePath = getSessionFilePath(userId);
    
    const session = {
        userId,
        history,
        lastUpdate: Date.now(),
        createdAt: Date.now()
    };
    
    try {
        const existingSession = await loadSession(userId);
        if (existingSession) {
            session.createdAt = existingSession.createdAt;
        }
        
        await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
        logger.info(`[SessionManager] Session saved for user ${userId}`);
    } catch (error) {
        logger.error(`[SessionManager] Error saving session for user ${userId}:`, error);
    }
}

// 세션 삭제
export async function deleteSession(userId) {
    await initSessionsDir();
    const filePath = getSessionFilePath(userId);
    
    try {
        await fs.unlink(filePath);
        logger.info(`[SessionManager] Session deleted for user ${userId}`);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return false; // 세션이 이미 없음
        }
        logger.error(`[SessionManager] Error deleting session for user ${userId}:`, error);
        return false;
    }
}

// 만료된 세션 정리 (주기적으로 실행 권장)
export async function cleanupExpiredSessions() {
    await initSessionsDir();
    
    try {
        const files = await fs.readdir(SESSIONS_DIR);
        let cleanedCount = 0;
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                const userId = file.replace('.json', '');
                const session = await loadSession(userId);
                
                if (!session) {
                    cleanedCount++;
                }
            }
        }
        
        if (cleanedCount > 0) {
            logger.info(`[SessionManager] Cleaned up ${cleanedCount} expired session(s)`);
        }
    } catch (error) {
        logger.error('[SessionManager] Error during cleanup:', error);
    }
}
