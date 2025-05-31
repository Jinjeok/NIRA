const { SlashCommandBuilder } = require('@discordjs/builders');
const _ = require('lodash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('글자')
    .setDescription('영어를 이모지로 변환')
    .addStringOption(o =>
      o.setName('content')
       .setDescription('변환할 문자열')
       .setRequired(true)
    ),

  async execute(interaction) {
    const str = interaction.options.getString('content');
    let emoji = '';
    for (const c of str) {
      const ch = c.toLowerCase().replace(/[0-9]|[^\!-z]/gi, ' ');
      if (ch !== ' ') emoji += `:regional_indicator_${ch}:`;
    }
    await interaction.reply(emoji || '영어만 보낼 수 있어요!');
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요