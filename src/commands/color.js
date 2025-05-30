const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const _ = require('lodash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('색')
    .setDescription('랜덤 또는 지정 색 출력')
    .addStringOption(o =>
      o.setName('16진수')
       .setDescription('16진수 색상 (예: ff0000)')
       .setRequired(false)
    )
    .addBooleanOption(o =>
      o.setName('preview')
       .setDescription('이미지 미리보기 여부')
       .setRequired(false)
    ),

  async execute(interaction) {
    const hex = interaction.options.getString('16진수');
    const preview = interaction.options.getBoolean('preview');
    const rand = hex && /^[0-9A-Fa-f]+$/.test(hex)
      ? parseInt(hex, 16)
      : _.random(1, 0xFFFFFE);

    const embed = new EmbedBuilder()
      .setColor(rand)
      .setDescription(`#${rand.toString(16).toUpperCase()}`);

    if (preview) {
      embed.setImage(`https://www.colorhexa.com/${rand.toString(16)}.png`);
    }

    await interaction.reply({ embeds: [embed] });
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요