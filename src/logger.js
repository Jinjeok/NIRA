const winston = require('winston');
const { combine, timestamp, printf, colorize } = winston.format;
const path = require('node:path'); // path 모듈 추가
const fs = require('node:fs'); // fs 모듈 추가

// 로그 파일을 저장할 폴더 경로
const logDir = 'logs';

// 로그 폴더가 없으면 생성
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const logFormat = printf(({ level, message, timestamp }) => {
    return `<span class="math-inline">\{timestamp\} \[</span>{level.toUpperCase()}]: ${message}`; // 레벨 대문자로 표시
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
        // 파일에 로그 저장
        new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
        new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
    ],
});

module.exports = logger;