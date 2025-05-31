const { SlashCommandBuilder } = require('@discordjs/builders');
const _ = require('lodash');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('랜덤')
    .setDescription('지정된 숫자 사이의 랜덤한 값을 출력합니다')
    .addIntegerOption(o =>
      o.setName('최소')
       .setDescription('최소값')
       .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('최대')
       .setDescription('최대값')
       .setRequired(true)
    ),

  async execute(interaction) {
    const min = interaction.options.getInteger('최소');
    const max = interaction.options.getInteger('최대');

    // 사용자가 min > max 로 입력한 경우, _.random은 자동으로 값을 스왑해서 처리합니다.
    // 사용자에게 명확한 정보를 주기 위해 실제 사용된 min, max 값을 표시합니다.
    const actualMin = Math.min(min, max);
    const actualMax = Math.max(min, max);

    const randomNumber = _.random(actualMin, actualMax);

    const embed = new EmbedBuilder()
      .setColor(0xEE82EE) // 테마 색상 (보라색 계열)
      .setTitle('🎲 랜덤 숫자 생성 결과')
      .addFields(
        { name: '입력된 최소값', value: `\`${min}\``, inline: true },
        { name: '입력된 최대값', value: `\`${max}\``, inline: true },
        { name: '생성된 숫자', value: `**\`${randomNumber}\`**` }
      )

    await interaction.reply({ embeds: [embed] });
  },
};