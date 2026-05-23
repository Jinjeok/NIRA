import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, ActivityType, MessageFlags } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import logger from './src/logger.js';
import scheduler from './src/schedule.js';
import { RUNTIME_CODENAMES, runtimeLabel } from './src/runtime/codenames.js';
import { migrateLocalState } from './src/storage/migrateLocalState.js';
import {
    ensureCommandSetting,
    ensureDefaultSettings,
    getCommandSetting,
    listCommandSettings,
    recordCommandExecution,
} from './src/storage/appStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    logger.on('finish', () => process.exit(1));
    logger.end();
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    logger.on('finish', () => process.exit(1));
    logger.end();
});

function createClient() {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
        ],
    });
    client.commands = new Collection();
    client.commandMetadata = [];
    return client;
}

function commandDescription(command) {
    return command?.data?.description || command?.data?.description_localizations?.ko || '';
}

async function loadCommands(client) {
    const commandsPath = path.join(__dirname, 'src', 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
    const metadata = [];

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const commandModule = await import(pathToFileURL(filePath).href);
            const command = commandModule.default || commandModule;
            if (command && 'data' in command && 'execute' in command) {
                const name = command.data.name;
                client.commands.set(name, command);
                ensureCommandSetting(name, { disabled: command.disabled === true });
                metadata.push({
                    name,
                    description: commandDescription(command),
                    fileName: file,
                    disabled: command.disabled === true,
                });
            } else {
                logger.warn(`[경고] ${filePath} 에 'data' 또는 'execute' 속성이 없습니다.`);
            }
        } catch (error) {
            logger.error(`Error loading command ${file}:`, error);
        }
    }

    client.commandMetadata = metadata;
    listCommandSettings(metadata);
}

function isAdminUser(userId) {
    const adminIds = (process.env.NIRA_ADMIN_USER_IDS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    return adminIds.includes(userId);
}

async function replyEphemeral(interaction, content) {
    if (!interaction.isRepliable()) return;
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content });
        return;
    }
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

async function handleInteraction(interaction, client) {
    if (interaction.isButton()) {
        const cid = interaction.customId || '';
        if (cid.startsWith('gemini_page_')) {
            const gemini = interaction.client.commands.get('제미나이');
            if (gemini?.handleComponent) {
                await gemini.handleComponent(interaction);
                return;
            }
        }
        if (cid.startsWith('perplexity_page_')) {
            const perplexity = interaction.client.commands.get('perplexity');
            if (perplexity?.handleComponent) {
                await perplexity.handleComponent(interaction);
                return;
            }
        }
    }

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    const startedAt = Date.now();

    if (!command) {
        logger.error(`슬래시 커맨드 "${interaction.commandName}"를 찾을 수 없습니다.`);
        recordCommandExecution({
            commandName: interaction.commandName,
            userId: interaction.user?.id,
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            status: 'error',
            durationMs: Date.now() - startedAt,
            errorMessage: 'Command module not found',
        });
        await replyEphemeral(interaction, '알 수 없는 명령어입니다.');
        return;
    }

    const setting = getCommandSetting(interaction.commandName, { disabled: command.disabled === true });
    if (!setting.enabled) {
        recordCommandExecution({
            commandName: interaction.commandName,
            userId: interaction.user?.id,
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            status: 'blocked',
            durationMs: Date.now() - startedAt,
            errorMessage: 'Command disabled',
        });
        await replyEphemeral(interaction, '현재 비활성화된 명령어입니다.');
        return;
    }

    if (setting.adminOnly && !isAdminUser(interaction.user?.id)) {
        recordCommandExecution({
            commandName: interaction.commandName,
            userId: interaction.user?.id,
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            status: 'blocked',
            durationMs: Date.now() - startedAt,
            errorMessage: 'Admin only command',
        });
        await replyEphemeral(interaction, '관리자 전용 명령어입니다.');
        return;
    }

    try {
        await command.execute(interaction, client, logger);
        recordCommandExecution({
            commandName: interaction.commandName,
            userId: interaction.user?.id,
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            status: 'success',
            durationMs: Date.now() - startedAt,
        });
    } catch (error) {
        logger.error('커맨드 또는 버튼 처리 중 오류:', error);
        recordCommandExecution({
            commandName: interaction.commandName,
            userId: interaction.user?.id,
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            status: 'error',
            durationMs: Date.now() - startedAt,
            errorMessage: error.message,
        });
        await replyEphemeral(interaction, '오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
}

export async function startBot({ enableScheduler = true } = {}) {
    ensureDefaultSettings();
    await migrateLocalState();

    const client = createClient();
    const runtime = {
        client,
        scheduler: null,
        codenames: RUNTIME_CODENAMES,
        get commandMetadata() {
            return client.commandMetadata || [];
        },
    };

    await loadCommands(client);

    const ready = new Promise((resolve) => {
        client.once('ready', () => {
            logger.info(`[Bot:${runtimeLabel('bot')}] NIRA 봇이 준비되었습니다! ${client.user.tag}로 로그인되었습니다.`);
            client.user.setPresence({
                activities: [{ name: '명령어 수신 대기중', type: ActivityType.Custom }],
                status: 'online',
            });

            if (enableScheduler) {
                runtime.scheduler = scheduler.initScheduler(client);
            }

            resolve(client);
        });
    });

    client.on('interactionCreate', (interaction) => {
        handleInteraction(interaction, client).catch((error) => {
            logger.error('Interaction handler failed:', error);
        });
    });

    await client.login(process.env.DISCORD_BOT_TOKEN).catch((error) => {
        logger.error('봇 로그인 중 오류 발생:', error);
        throw error;
    });

    return { client, ready, runtime };
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
    startBot().catch((error) => {
        logger.error('NIRA startup failed:', error);
        process.exit(1);
    });
}
