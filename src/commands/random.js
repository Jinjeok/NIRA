const { SlashCommandBuilder } = require('@discordjs/builders');
const _ = require('lodash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('랜덤')
    .setDescription('정수 랜덤 추출')
    .addIntegerOption(o =>
      o.setName('min')
       .setDescription('최소값')
       .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('max')
       .setDescription('최대값')
       .setRequired(true)
    ),

  async execute(interaction) {
    const min = interaction.options.getInteger('min');
    const max = interaction.options.getInteger('max');
    await interaction.reply(String(_.random(min, max)));
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요