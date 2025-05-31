// ./commands/serverinfo.js

const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('서버정보')
    .setDescription('현재 서버 정보를 알려줘요.'),
  
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0xEE82EE)
      .setTitle('서버 정보')
      .setDescription(
        `서버 이름 : ${interaction.guild.name}\n` +
        `총 Members : **${interaction.guild.memberCount}**명`
      );

    await interaction.reply({
      content: '현재 서버 정보에요.',
      embeds: [embed],
      ephemeral: false  // 기본값이 false이므로 생략 가능
    });
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요