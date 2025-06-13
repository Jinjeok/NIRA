import { SlashCommandBuilder } from '@discordjs/builders';

export default {
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
