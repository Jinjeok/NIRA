const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, MessageFlags } = require('discord.js');
const _ = require('lodash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('복권')
    .setDescription('로또 등수를 랜덤으로 뽑거나 확률표를 보여줍니다.')
    .addBooleanOption(option =>
      option.setName('확률표보기')
        .setDescription('확률표만 보려면 true로 설정하세요. (기본값: false)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const probabilities = [
      { rank: 1, count: 2, description: '1등' },     // 0.02%
      { rank: 2, count: 20, description: '2등' },    // 0.2%
      { rank: 3, count: 150, description: '3등' },   // 1.5%
      { rank: 4, count: 700, description: '4등' },   // 7%
      { rank: 5, count: 1500, description: '5등' },  // 15%
      { rank: 6, count: 7628, description: '6등' },  // 76.28%
    ]; // Total: 10000 tickets

    const totalTickets = probabilities.reduce((sum, p) => sum + p.count, 0);
    const showProbabilityTableOnly = interaction.options.getBoolean('확률표보기') ?? false;

    if (showProbabilityTableOnly) {
      const probabilityEmbed = new EmbedBuilder()
        .setColor(0xEE82EE) // 보라색 계열
        .setTitle('스크래치 복권 - 등수별 당첨 확률');

      probabilities.forEach(p => {
        const percentage = ((p.count / totalTickets) * 100).toFixed(2);
        probabilityEmbed.addFields({ name: `${p.rank}등`, value: `${percentage}% (${p.count.toLocaleString()} / ${totalTickets.toLocaleString()})`, inline: true });
      });
      await interaction.reply({ embeds: [probabilityEmbed], flags: MessageFlags.Ephemeral });
    } else {
      const lottoPool = [];
      probabilities.forEach(p => {
        for (let i = 0; i < p.count; i++) {
          lottoPool.push(p.rank);
        }
      });

      const results = [];
      for (let i = 0; i < 5; i++) { // 기본 5회 뽑기
        results.push(_.sample(lottoPool));
      }

      const embed = new EmbedBuilder()
        .setColor(0xEE82EE) // 보라색 계열
        .setTitle('스크래치 복권 (5회)')
        .setDescription('🎉 복권 결과입니다! 각 결과를 확인해보세요. 🎉')
        .setFooter({ text: '결과를 확인하려면 메시지를 클릭(터치)하세요.' });

      results.forEach((result, index) => {
        embed.addFields({ name: `${index + 1}번째 복권`, value: `**||${result}등||**`, inline: true });
      });

      await interaction.reply({ embeds: [embed] });
    }
  },
};