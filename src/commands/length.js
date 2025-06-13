import { SlashCommandBuilder } from '@discordjs/builders';

export default {
  data: new SlashCommandBuilder()
    .setName('길이')
    .setDescription('입력 문자열의 길이를 측정합니다.')
    .addStringOption(o =>
      o.setName('문자열')
       .setDescription('측정할 문자열')
       .setRequired(true)
    ),

  async execute(interaction) {
    const str = interaction.options.getString('문자열');
    await interaction.reply(String(str.length));
  },
};