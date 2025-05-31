const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const _ = require('lodash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('트라이')
    .setDescription('n번 시도 후 성공 횟수')
    .addNumberOption(o =>
      o.setName('prob')
       .setDescription('% 확률')
       .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('trials')
       .setDescription('시도 횟수')
       .setRequired(true)
    ),

  async execute(interaction) {
    const p = interaction.options.getNumber('prob');
    const n = interaction.options.getInteger('trials');
    if (n > 999) {
      return interaction.reply('시도 횟수는 3자리 이하만 가능합니다.');
    }

    let success = 0;
    for (let i = 0; i < n; i++) {
      if (_.random(1, 1_000_000) <= p * 10000) success++;
    }

    const embed = new EmbedBuilder()
      .setTitle('트라이 결과')
      .setDescription(
        `시도: ${n}회\n` +
        `성공: ${success}회\n` +
        `성공률: ${(success / n * 100).toFixed(2)}%`
      )
      .setColor(0xEE82EE)
      .setTimestamp()
      .setFooter({ text: '명령어 입력 시간', iconURL: interaction.client.user.displayAvatarURL() });

    await interaction.reply({ embeds: [embed] });
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요