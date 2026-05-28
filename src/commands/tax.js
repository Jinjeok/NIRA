import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder } from '../discord.js';
import axios from 'axios';

export default {
  data: new SlashCommandBuilder()
    .setName('소비세')
    .setDescription('엔화 금액의 소비세 및 원화 환산 가격을 계산')
    .addNumberOption(o =>
      o.setName('엔화')
       .setDescription('💴엔화 금액￥')
       .setRequired(true)
    ),

  async execute(interaction) {
    const yenInput = interaction.options.getNumber('엔화'); // 옵션 이름 '엔화' 사용
    const yenWith10Tax = Math.floor(yenInput * 1.10);
    const yenWith8Tax  = Math.floor(yenInput * 1.08);

    const { data } = await axios.get('http://api.manana.kr/exchange/rate/KRW/JPY.json');
    // API는 1 JPY당 KRW 환율을 제공 (예: 1 JPY = 9.5 KRW)
    const jpyToKrwRate = parseFloat(data[0].rate);
    const rateDate = data[0].date;

    const krwFor10Tax = yenWith10Tax * jpyToKrwRate;
    const krwFor8Tax  = yenWith8Tax * jpyToKrwRate;

    const embed = new EmbedBuilder()
      .setTitle(`💴 엔화 소비세 계산 (세전: ${yenInput.toLocaleString()}엔)`)
      .setColor(0xEE82EE)
      .addFields(
        {
          name: '소비세 10% 적용',
          value: `세후 엔화: **¥ ${yenWith10Tax.toLocaleString()}**\n` +
                 `원화 환산: **₩ ${krwFor10Tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**`,
          inline: true
        },
        {
          name: '소비세 8% 적용',
          value: `세후 엔화: **¥ ${yenWith8Tax.toLocaleString()}**\n` +
                 `원화 환산: **₩ ${krwFor8Tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**`,
          inline: true
        }
      )
      .setFooter({ text: `환율 기준일: ${rateDate} (1 JPY = ${jpyToKrwRate.toFixed(4)} KRW)` })
    await interaction.reply({ embeds: [embed] });
  },
};