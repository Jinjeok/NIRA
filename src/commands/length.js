const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('길이')
    .setDescription('문자열 길이를 리턴')
    .addStringOption(o =>
      o.setName('content')
       .setDescription('측정할 문자열')
       .setRequired(true)
    ),

  async execute(interaction) {
    const str = interaction.options.getString('content');
    await interaction.reply(String(str.length));
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요