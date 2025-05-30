// ./commands/선택.js

const { SlashCommandBuilder } = require('@discordjs/builders');
const _ = require('lodash');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('선택_deprecated')
    .setDescription('무엇을 고를지 고민이 될 때는 후미카씨한테 맡겨봐요.(사용법 : 선택지1, 선택지2, 선택지3...)')
    .addStringOption(option =>
      option
        .setName('input')
        .setDescription('선택지를 콤마(,)로 구분해서 넣어보세요.')
        .setRequired(false)
    ),

  async execute(interaction) {
    const input = interaction.options.getString('input');
    const embed = new EmbedBuilder()
      .setColor(0x3498DB);

    if (!input) {
      embed.setDescription('선택지에 놓인 게 없나봐요!');
    } else {
      // 콤마로 나눈 뒤, 앞뒤 공백도 제거
      const choices = input.split(',').map(s => s.trim()).filter(Boolean);
      const pick = choices[_.random(choices.length - 1)];
      embed.setDescription(pick);
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: false  // 생략 가능 (기본값이 false)
    });
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요