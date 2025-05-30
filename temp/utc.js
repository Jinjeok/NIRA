const { SlashCommandBuilder } = require('@discordjs/builders');
const date = require('date-and-time');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('utc')
    .setDescription('UTC ↔ GMT+9 변환')
    .addStringOption(o =>
      o.setName('date')
       .setDescription('YYMMDDHHmm / YYYYMMDDHHmm')
       .setRequired(true)
    )
    .addBooleanOption(o =>
      o.setName('reverse')
       .setDescription('UTC → 로컬 변환')
       .setRequired(false)
    ),

  async execute(interaction) {
    const s = interaction.options.getString('date');
    const rev = interaction.options.getBoolean('reverse');
    let dt = date.parse(s, 'YYMMDDHHmm') || date.parse(s, 'YYYYMMDDHHmm');
    if (!dt) return interaction.reply('올바른 날짜 포맷이 아닙니다!');
    const result = rev ? date.addHours(dt, 9) : date.addHours(dt, -9);
    await interaction.reply(date.format(result, 'YYYY-MM-DD \nA hh:mm:ss'));
  },
};
