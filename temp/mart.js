const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const date = require('date-and-time');

const getWeekNo = d => {
  const first = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  return Math.ceil((d.getDate() + first) / 7);
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('주일')
    .setDescription('마트 의무휴업일 확인'),

  async execute(interaction) {
    const today = new Date();
    const weekNo = getWeekNo(today);
    const status = (weekNo === 2 || weekNo === 4) ? '의무휴업' : '영업';

    const embed = new EmbedBuilder()
      .setTitle('마트 영업일 정보')
      .addFields({ name: `${date.format(today, 'YYYY-MM-DD')} — ${weekNo}주차`, value: status })
      .setColor(0x3498DB)
      .setFooter({ text: '명령어 입력 시간', iconURL: interaction.client.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
