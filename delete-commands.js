require('dotenv').config();
const { REST, Routes } = require('discord.js');
const logger = require('./src/logger');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        if (process.env.GUILD_ID) {
            logger.info(`길드 ID: ${process.env.GUILD_ID}의 모든 (/) 커맨드를 삭제합니다.`);
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: [] },
            );
            logger.info('성공적으로 길드 커맨드를 삭제했습니다.');
        } else {
            logger.info('모든 전역 (/) 커맨드를 삭제합니다.');
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: [] },
            );
            logger.info('성공적으로 전역 커맨드를 삭제했습니다.');
        }
    } catch (error) {
        logger.error('커맨드 삭제 중 오류 발생:', error);
    }
})();