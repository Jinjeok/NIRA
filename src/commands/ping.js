// commands/ping.js
import { SlashCommandBuilder } from '../discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('핑')
        .setDescription('NIRA 봇이 살아있는지 확인합니다.'),
    // execute 함수는 나중에 index.js에서 커맨드 처리에 사용될 부분입니다.
    // 여기서는 커맨드 정의만 포함합니다.
    async execute(interaction, client, logger) {
        const ping = client.ws.ping;
        logger.info(`'/핑' 명령어가 실행되었습니다.`);
        await interaction.reply(`🏓 퐁! 현재 NIRA는 정상작동중입니다.`);
    },
};