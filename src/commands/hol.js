const { SlashCommandBuilder } = require('@discordjs/builders');
const _ = require('lodash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('홀짝')
    .setDescription('홀/짝을 맞춰보세요')
    .addStringOption(o =>
      o.setName('choice')
       .setDescription('“홀” 또는 “짝”')
       .setRequired(false)
    ),

  async execute(interaction) {
    const choice = interaction.options.getString('choice');
    const answer = choice && /^홀|1/.test(choice) ? 1 : 0;
    const rand = _.random(1000000000) % 2;
    const text = rand === answer
      ? `맞았어요! : ${rand}`
      : `틀렸어요 : ${rand}`;

    await interaction.reply(text);
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요