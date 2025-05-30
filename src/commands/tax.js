const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('소비세')
    .setDescription('엔화 금액의 소비세 및 원화 환산 가격을 계산')
    .addNumberOption(o =>
      o.setName('amount')
       .setDescription('엔화 금액')
       .setRequired(true)
    ),

  async execute(interaction) {
    const amt = interaction.options.getNumber('amount');
    const amt10 = Math.floor(amt * 1.10);
    const amt8  = Math.floor(amt * 1.08);
    const { data } = await axios.get('http://api.manana.kr/exchange/rate/KRW/JPY.json');
    const rate = parseFloat(data[0].rate);

    const embed = new EmbedBuilder()
      .setTitle('소비세 계산')
      .setColor(0x3498DB)
      .addFields(
        {
          name: '10%',
          value: `엔화 총액: **${amt10}엔**\n₩ ${(rate * amt10).toFixed(2).toLocaleString()}원 (${data[0].date})`
        },
        {
          name: '8%',
          value: `엔화 총액: **${amt8}엔**\n₩ ${(rate * amt8).toFixed(2).toLocaleString()}원 (${data[0].date})`
        }
      )
      .setTimestamp()
      .setFooter({ text: '명령어 입력 시간', iconURL: interaction.client.user.displayAvatarURL() });

    await interaction.reply({ embeds: [embed] });
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요