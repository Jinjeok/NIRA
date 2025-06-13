import { SlashCommandBuilder } from '@discordjs/builders';

export default {
  data: new SlashCommandBuilder()
    .setName('나이')
    .setDescription('세는 나이 계산 (YYYY)')
    .addIntegerOption(o =>
      o.setName('년도')
       .setDescription('출생 연도 (YYYY)')
       .setRequired(true)
    ),

  async execute(interaction) {
    const birthYear = interaction.options.getInteger('년도');
    const currentYear = new Date().getFullYear();
    await interaction.reply(`**${birthYear}**년생의 세는나이: **${currentYear - birthYear + 1}** 세`);
  },
};
