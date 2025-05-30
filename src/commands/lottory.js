const { SlashCommandBuilder } = require('@discordjs/builders');
const _ = require('lodash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('복권')
    .setDescription('로또 등수를 랜덤으로 뽑아요'),

  async execute(interaction) {
    const lotto = [1,2,2,3,3,3,4,4,4,4,5,5,5,5,5,6,6,6,6,6,6];
    await interaction.reply(`||${_.sample(lotto)}등!||`);
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요