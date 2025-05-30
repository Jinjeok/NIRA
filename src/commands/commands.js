// ./commands/명령어.js

const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('명령어')
    .setDescription('후미카씨의 모든 명령어를 List해둔 링크를 드려요.'),
  
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x3498DB)  // 3447003(decimal) → 0x3498DB(hex)
      .setTitle('명령어 일람')
      .setDescription(
        '은하도서관에 어서오세요!\n' +
        'https://libraryofgalaxy.kr/fumika/index'
      );

    await interaction.reply({
      content: '후미카씨의 모든 명령어를 볼 수 있는 링크에요.',
      embeds: [embed],
      ephemeral: false  // 기본값이 false이므로 생략 가능
    });
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요