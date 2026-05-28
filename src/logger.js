import winston from 'winston';
const { combine, timestamp, printf, colorize } = winston.format;
import path from 'node:path';
import 'winston-daily-rotate-file';
import fs from 'node:fs';

const logDir = 'logs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const logFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

const LOG_BUFFER_SIZE = 500;
const logBuffer = [];
const MESSAGE = Symbol.for('message');

class MemoryTransport extends winston.Transport {
    log(info, callback) {
        logBuffer.push({
            level: info.level,
            text: info[MESSAGE] || `${info.timestamp || ''} [${(info.level || '').toUpperCase()}]: ${info.message || ''}`,
        });
        if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();
        setImmediate(callback);
    }
}

export function getRecentLogs({ limit = 200 } = {}) {
    return logBuffer.slice(-Math.min(limit, logBuffer.length)).reverse();
}

const logger = winston.createLogger({
    level: 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat // 파일 로그에는 색상 없이 사용자 정의 형식 적용
    ),
    transports: [
        // 콘솔에 로그 출력 (개발 시 유용)
        new winston.transports.Console({
            format: combine(
                // TTY 환경(터미널)에서만 색상 적용, systemd 등에서는 색상 제거하여 [blob data] 방지
                ...(process.stdout.isTTY ? [colorize()] : []),
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                logFormat
            ),
        }),
        // 오류 로그 파일 (매일 로테이션, 7일 보관)
        new winston.transports.DailyRotateFile({
            level: 'error',
            filename: path.join(logDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true, // 오래된 로그 압축
            maxSize: '20m',      // 개별 파일 최대 크기
            maxFiles: '7d',      // 7일간 보관 후 자동 삭제
        }),
        new winston.transports.DailyRotateFile({
            filename: path.join(logDir, 'combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '7d',
        }),
        new MemoryTransport({ level: 'info' }),
    ],
});

export default logger;