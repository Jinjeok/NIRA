const { SlashCommandBuilder } = require('@discordjs/builders');
const moment = require('moment');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('시계')
    .setDescription('현재 시각 표시')
    .addIntegerOption(o =>
      o.setName('시차')
       .setDescription('±시간 (정수) | KST기준 PST = -16, UTC = -9')
       .setRequired(false)
    ),

  async execute(interaction) {
    const off = interaction.options.getInteger('시차') || 0;
    const now = moment().locale('ko');
    if(off) {
      now.add(off,'hours')
    }
    await interaction.reply(now.format('llll'));
  },
};
