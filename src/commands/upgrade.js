const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const _ = require('lodash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('강화')
    .setDescription('강화 시뮬레이션')
    .addNumberOption(o =>
      o.setName('prob')
       .setDescription('기본 확률(%)')
       .setRequired(true)
    )
    .addNumberOption(o =>
      o.setName('inc')
       .setDescription('증가 확률(%)')
       .setRequired(false)
    ),

  async execute(interaction) {
    const p = interaction.options.getNumber('prob');
    const inc = interaction.options.getNumber('inc') || 0;
    if (`${p}`.length > 7 || `${inc}`.length > 7) {
      return interaction.reply('퍼센트 소숫점 포함 7자리 이하만 가능합니다.');
    }
    for (let i = 1; i < 5_000_000; i++) {
      if (_.random(1, 1_000_000) <= (p + inc * (i - 1)) * 10000) {
        const embed = new EmbedBuilder()
          .setTitle('강화 성공!')
          .setDescription(`총 ${i.toLocaleString()}번 만에 성공\n최종확률: ${p + inc * (i - 1)}%`)
          .setColor(0xEE82EE)

        return interaction.reply({ embeds: [embed] });
      }
    }
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요