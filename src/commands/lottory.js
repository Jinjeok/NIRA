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
      { rank: 1, count: 1, description: '1등 (0.01%)' },
      { rank: 2, count: 10, description: '2등 (0.1%)' },
      { rank: 3, count: 100, description: '3등 (1%)' },
      { rank: 4, count: 500, description: '4등 (5%)' },
      { rank: 5, count: 1000, description: '5등 (10%)' },
      { rank: 6, count: 8389, description: '6등 (83.89%)' },
    ];

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

      const result = _.sample(lottoPool);

      const embed = new EmbedBuilder()
        .setColor(0xEE82EE) // 보라색 계열
        .setTitle('스크래치 복권')
        .setDescription(`🎉 축하합니다! **||${result}등||**에 당첨되셨습니다! 🎉`)

      await interaction.reply({ embeds: [embed] });
    }
  },
};

// 하루에 한번만 가능하게? ㅋㅋ 그러면 확률좀 늘려야할듯?