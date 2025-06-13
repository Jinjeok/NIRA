import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder } from 'discord.js';
import _ from 'lodash';

export default {
  data: new SlashCommandBuilder()
    .setName('컬러')
    .setDescription('랜덤 또는 지정된 색을 출력합니다.')
    .addStringOption(o =>
      o.setName('16진수')
       .setDescription('16진수 색상 (예: ff0000)')
       .setRequired(false)
    )
    .addBooleanOption(o =>
      o.setName('미리보기')
       .setDescription('이미지 미리보기 여부')
       .setRequired(false)
    ),

  async execute(interaction) {
    const hex = interaction.options.getString('16진수');
    const preview = interaction.options.getBoolean('미리보기');
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
