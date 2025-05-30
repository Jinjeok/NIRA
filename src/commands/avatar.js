// ./commands/아바타.js

const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('아바타')
    .setDescription('본인의 아바타를 출력합니다.'),
  
  async execute(interaction) {
    // 유저의 아바타 URL을 동적으로 가져옵니다.
    const avatarUrl = interaction.user.displayAvatarURL({ dynamic: true, size: 1024 });
    
    await interaction.reply({
      content: avatarUrl
    });
  },
};

//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요