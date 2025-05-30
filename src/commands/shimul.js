const { SlashCommandBuilder } = require('@discordjs/builders');
const _ = require('lodash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('시뮬')
    .setDescription('확률 시뮬레이션')
    .addNumberOption(o =>
      o.setName('prob')
       .setDescription('% 확률')
       .setRequired(true)
    ),

  async execute(interaction) {
    const p = interaction.options.getNumber('prob');
    if (`${p}`.length > 7) {
      return interaction.reply('소숫점 포함 7자리 이하만 가능합니다.');
    }
    for (let i = 1; i < 5_000_000; i++) {
      if (_.random(1, 1_000_000) <= p * 10000) {
        return interaction.reply(`총 ${i.toLocaleString()}번 만에 성공했습니다`);
      }
    }
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요