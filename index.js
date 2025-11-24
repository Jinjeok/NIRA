// index.js
import 'dotenv/config'
import { Client, GatewayIntentBits, Collection, ActivityType  } from 'discord.js';
import logger from './src/logger.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import scheduler from './src/schedule.js'; // 스케줄러 모듈 가져오기

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
    ]
});
client.commands = new Collection();

async function loadCommands() {
    const commandsPath = path.join(__dirname, 'src', 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const commandModule = await import(pathToFileURL(filePath).href);
            const command = commandModule.default || commandModule;
            if (command && 'data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
            } else {
                logger.warn(`[경고] ${filePath} 에 'data' 또는 'execute' 속성이 없습니다.`);
            }
        } catch (error) {
            logger.error(`Error loading command ${file}:`, error);
        }
    }
}

async function main() {
    await loadCommands();

    client.once('ready', () => {
        logger.info(`NIRA 봇이 준비되었습니다! ${client.user.tag}으로 로그인되었습니다.`);
        client.user.setPresence({ activities: [{ name: "명령어 수신 대기중", type: ActivityType.Custom }], status: 'online' });
        scheduler.initScheduler(client); // 스케줄러 초기화
    });

    client.on('interactionCreate', async interaction => {
        try {
            // 최소 라우팅만 추가: 핫딜 버튼은 커맨드 모듈에서 처리
            if (interaction.isButton()) {
                const cid = interaction.customId || '';
                if (cid.startsWith('hotdeal_prev:') || cid.startsWith('hotdeal_next:')) {
                    const hotdeal = interaction.client.commands.get('핫딜');
                    if (hotdeal?.handleComponent) {
                        await hotdeal.handleComponent(interaction);
                        return;
                    }
                }
                if (cid.startsWith('gemini_prev:') || cid.startsWith('gemini_next:') || cid.startsWith('gemini_first:') || cid.startsWith('gemini_last:')) {
                    const gemini = interaction.client.commands.get('제미나이');
                    if (gemini?.handleComponent) {
                        await gemini.handleComponent(interaction);
                        return;
                    }
                }
            }

            if (!interaction.isChatInputCommand()) return;

            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                logger.error(`슬래시 커맨드 "${interaction.commandName}"를 찾을 수 없습니다.`);
                await interaction.reply({ content: '알 수 없는 명령어입니다.', ephemeral: true });
                return;
            }

            await command.execute(interaction, client, logger);
        } catch (error) {
            logger.error(`커맨드/버튼 처리 중 오류:`, error);
            if (interaction.isRepliable()) {
                if (interaction.deferred) {
                    await interaction.editReply({ content: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
                } else {
                    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true });
                }
            }
        }
    });

    client.login(process.env.DISCORD_BOT_TOKEN)
        .catch(error => {
            logger.error('봇 로그인 중 오류 발생:', error);
            process.exit(1);
        });
}

main();
