const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('말')
    .setDescription('메시지를 제가 대신 보냅니다.')
    .addStringOption(o =>
      o.setName('content')
       .setDescription('보낼 메시지')
       .setRequired(true)
    ),

  async execute(interaction) {
    const content = interaction.options.getString('content');
    await interaction.reply({ content, ephemeral: false });
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요