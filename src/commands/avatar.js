// ./commands/아바타.js

import { SlashCommandBuilder } from '@discordjs/builders';

export default {
  data: new SlashCommandBuilder()
    .setName('아바타')
    .setDescription('본인의 아바타를 출력합니다.'),
  
  async execute(interaction) {
    const avatarUrl = interaction.user.displayAvatarURL({ dynamic: true, size: 1024 });
    
    await interaction.reply({
      content: avatarUrl
    });
  },
};