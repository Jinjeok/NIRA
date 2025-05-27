require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const logger = require('./src/logger');

const commands = [];
// commands 폴더의 경로를 src/commands로 변경합니다.
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command) {
        commands.push(command.data.toJSON());
    } else {
        logger.warn(`[경고] ${filePath}에 'data' 속성이 없습니다.`);
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        logger.info(`총 ${commands.length}개의 (/) 커맨드를 새로고침합니다.`);

        const data = process.env.GUILD_ID
            ? await rest.put(
                  Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                  { body: commands },
              )
            : await rest.put(
                  Routes.applicationCommands(process.env.CLIENT_ID),
                  { body: commands },
              );

        logger.info(`성공적으로 ${data.length}개의 (/) 커맨드를 새로고침했습니다.`);
    } catch (error) {
        logger.error('커맨드 새로고침 중 오류 발생:', error);
    }
})();