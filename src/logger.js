import winston from 'winston';
const { combine, timestamp, printf, colorize } = winston.format;
import path from 'node:path'; // path 모듈 추가
import 'winston-daily-rotate-file'; // DailyRotateFile 트랜스포트 추가
import fs from 'node:fs'; // fs 모듈 추가

// 로그 파일을 저장할 폴더 경로
const logDir = 'logs';

// 로그 폴더가 없으면 생성
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const logFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message}`; // 레벨 대문자로 표시
});

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
                colorize(), // 콘솔에는 색상 추가
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
        // 모든 레벨 로그 파일 (매일 로테이션, 7일 보관)
        new winston.transports.DailyRotateFile({
            filename: path.join(logDir, 'combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '7d',
        }),
    ],
});

export default logger;