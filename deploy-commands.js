import 'dotenv/config'
import { REST, Routes } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import logger from './src/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = [];
// commands 폴더의 경로를 src/commands로 변경합니다.
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const commandModule = await import(pathToFileURL(filePath).href);
            const command = commandModule.default || commandModule; // ES 모듈의 default export를 사용한다고 가정
            if (command && 'data' in command) {
                commands.push(command.data.toJSON());
            } else {
                logger.warn(`[경고] ${filePath} 에 'data' 속성이 없습니다.`);
            }
        } catch (error) {
            logger.error(`Error loading command for deployment ${file}:`, error);
        }
    }

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