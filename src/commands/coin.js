const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const moment = require('moment');
require('moment/locale/ko');

const coinMap = {
  '비트코인':'BTC','이더리움':'ETH','리플':'XRP','이오스':'EOS',
  '트론':'TRX','에이다':'ADA','샌드박스':'SAND'
  // 필요에 따라 여기에 더 많은 코인을 추가할 수 있습니다.
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('코인')
    .setDescription('빗썸 코인 시세 조회')
    .addStringOption(o =>
      o.setName('코인명')
       .setDescription('코인명 (예: 비트코인)')
       .setRequired(false)
       .addChoices(
         ...Object.keys(coinMap).map(name => ({ name: name, value: coinMap[name] }))
       )
    ),

  async execute(interaction) {
    const nameOrSymbol = interaction.options.getString('코인명'); 
    const symbol = coinMap[nameOrSymbol] || nameOrSymbol || 'BTC'; 
    const res = await axios.get(`https://api.bithumb.com/public/ticker/${encodeURIComponent(symbol)}`);
    const d = res.data.data;
    if (res.data.status !== '0000') {
      return interaction.reply('해당 코인이 없습니다.');
    }

    const open  = Number(d.opening_price).toLocaleString();
    const close = Number(d.closing_price).toLocaleString();
    const low   = Number(d.min_price).toLocaleString();
    const high  = Number(d.max_price).toLocaleString();
    const prev  = Number(d.prev_closing_price).toLocaleString();
    const rate24 = Number(d.fluctate_24H).toLocaleString();
    const pct    = parseFloat(d.fluctate_rate_24H).toFixed(2);
    const nowDt  = moment(Number(d.date));

    const embed = new EmbedBuilder()
      .setTitle(`코인 ${symbol} 가격`)
      .setColor(pct.startsWith('-') ? 0x3A6CE8 : 0xF93345)
      .setDescription(
        `00시 시작가: ${open}원\n` +
        `현재가: ${close}원\n` +
        `00시 기준 최저가: ${low}원\n` +
        `금일 최고가: ${high}원\n` +
        `전일 종가: ${prev}원\n` +
        `최근 24시간 변동가: ${rate24}원 (${pct}%)\n` +
        `기준시각: ${nowDt.format('lll')}`
      )
      .setFooter({ text: '면책조항\n해당 정보는 단순 조회를 위한 정보이며 해당 기능으로 인해 발생하는 피해는 책임지지 않습니다.'})

    await interaction.reply({ embeds: [embed] });
  },
};
