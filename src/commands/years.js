const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('나이')
    .setDescription('세는 나이 계산 (YYYY)')
    .addIntegerOption(o =>
      o.setName('year')
       .setDescription('출생 연도 (YYYY)')
       .setRequired(true)
    ),

  async execute(interaction) {
    const birthYear = interaction.options.getInteger('year');
    const currentYear = new Date().getFullYear();
    await interaction.reply(`나이: ${currentYear - birthYear + 1}`);
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요