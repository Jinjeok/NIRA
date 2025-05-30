const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('거꾸로')
    .setDescription('문장을 거꾸로 출력')
    .addStringOption(o =>
      o.setName('content')
       .setDescription('입력할 문장')
       .setRequired(true)
    ),

  async execute(interaction) {
    const str = interaction.options.getString('content');
    await interaction.reply(str.split('').reverse().join(''));
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요