import 'dotenv/config';
import logger from './src/logger.js';
import { deployCommands } from './src/utils/deployCommands.js';

(async () => {
    try {
        logger.info('커맨드 배포 시작...');
        const result = await deployCommands();
        logger.info(`성공적으로 ${result.deployed}개의 (/) 커맨드를 배포했습니다.`);
    } catch (error) {
        logger.error('커맨드 배포 중 오류 발생:', error);
        process.exit(1);
    }
})();
