const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('환율')
    .setDescription('환율을 조회하고 환산해 줍니다.')
    .addStringOption(opt =>
      opt.setName('pair')
         .setDescription('환산할 통화 쌍을 선택하세요.')
         .setRequired(true)
         .addChoices(
           { name: 'KRW → JPY', value: 'kj' },
           { name: 'JPY → KRW', value: 'jk' },
           { name: 'KRW → USD', value: 'ku' },
           { name: 'USD → KRW', value: 'uk' }
         )
    )
    .addNumberOption(opt =>
      opt.setName('amount')
         .setDescription('기준 통화 단위 (기본 단위 자동)')
         .setRequired(false)
    ),

  async execute(interaction) {
    const pair = interaction.options.getString('pair');
    let amt = interaction.options.getNumber('amount');
    let base, target, defaultUnit;

    switch (pair) {
      case 'kj': base = 'KRW'; target = 'JPY'; defaultUnit = 100; break;
      case 'jk': base = 'JPY'; target = 'KRW'; defaultUnit = 100; break;
      case 'ku': base = 'KRW'; target = 'USD'; defaultUnit = 1000; break;
      case 'uk': base = 'USD'; target = 'KRW'; defaultUnit = 1; break;
    }
    if (amt == null || isNaN(amt)) amt = defaultUnit;

    try {
      const res = await axios.get(`http://api.manana.kr/exchange/rate/${target}/${base}.json`);
      const rate = parseFloat(res.data[0].rate);
      const converted = (rate * amt).toFixed(2);

      const embed = new EmbedBuilder()
        .setTitle(`${base} → ${target} 환율`)
        .addFields({
          name: `환산 결과`,
          value: `• ${amt} ${base} = ${converted.toLocaleString()} ${target}`
        })
        .setFooter({ text: `${res.data[0].date} 기준`, iconURL: interaction.client.user.displayAvatarURL() })
        .setColor(0x3498DB)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: `Error: ${err.message}`, ephemeral: true });
    }
  },
};
