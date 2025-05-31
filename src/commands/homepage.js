// ./commands/명령어.js

const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('홈페이지')
    .setDescription('NIRA의 공식 문서 모든 명령어를 List해둔 링크를 드려요.'),

  async execute(interaction) {
    // GitHub Pages로 배포한 'docs' 폴더의 주소를 입력해주세요.
    const homepageUrl = 'https://jinjeok.github.io/NIRA/';

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('홈페이지 방문하기')
          .setStyle(ButtonStyle.Link)
          .setURL(homepageUrl)
      );

    await interaction.reply({
      components: [row],
      ephemeral: false  // 기본값이 false이므로 생략 가능
    });
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요