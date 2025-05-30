const { SlashCommandBuilder } = require('@discordjs/builders');
const _ = require('lodash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('오미쿠지')
    .setDescription('운세 뽑기'),

  async execute(interaction) {
    const list = ['대흉','말흉','반흉','소흉','흉','평','말소길','말길','반길','길','소길','중길','대길'];
    await interaction.reply(_.sample(list));
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요