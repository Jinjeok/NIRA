const { SlashCommandBuilder } = require('@discordjs/builders');
const _ = require('lodash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('한글')
    .setDescription('랜덤 한글 문자열 생성')
    .addIntegerOption(o =>
      o.setName('count')
       .setDescription('개수 (최대 2000)')
       .setRequired(false)
    ),

  async execute(interaction) {
    const cnt = interaction.options.getInteger('count') || 1;
    if (cnt > 2000) return interaction.reply('최대 2000개까지 지원합니다.');

    let out = '';
    for (let i = 0; i < cnt; i++) {
      out += String.fromCharCode(44031 + _.random(0, 11171));
    }
    await interaction.reply(out);
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요