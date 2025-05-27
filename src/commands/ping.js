// commands/ping.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('핑')
        .setDescription('NIRA 봇의 현재 핑을 알려줍니다.'),
    // execute 함수는 나중에 index.js에서 커맨드 처리에 사용될 부분입니다.
    // 여기서는 커맨드 정의만 포함합니다.
    async execute(interaction, client, logger) {
        const ping = client.ws.ping;
        logger.info(`'/핑' 명령어가 실행되었습니다. 봇의 핑: ${ping}ms`);
        await interaction.reply(`현재 봇의 핑은 **${ping}ms** 입니다.`);
    },
};