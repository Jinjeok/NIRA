const { SlashCommandBuilder } = require('@discordjs/builders');
const date = require('date-and-time');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('날짜')
    .setDescription('오늘과의 일수 차이 계산')
    .addStringOption(o =>
      o.setName('date')
       .setDescription('YYMMDD 또는 YYYYMMDD')
       .setRequired(true)
    ),

  async execute(interaction) {
    const s = interaction.options.getString('date');
    let dt = date.parse(s, 'YYMMDD') || date.parse(s, 'YYYYMMDD');
    if (!dt) return interaction.reply('올바른 날짜 포맷이 아닙니다!');
    const diff = Math.ceil((dt - new Date()) / (1000 * 60 * 60 * 24));
    await interaction.reply(`${diff}일`);
  },
};
