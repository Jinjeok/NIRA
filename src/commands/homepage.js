// ./commands/명령어.js

const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('홈페이지')
    .setDescription('NIRA의 홈페이지 링크를 출력합니다.'),

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
      components: [row]
    });
  },
};