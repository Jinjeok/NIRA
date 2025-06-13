import { SlashCommandBuilder } from '@discordjs/builders';

export default {
  data: new SlashCommandBuilder()
    .setName('base64')
    .setDescription('Base64 코드/평문 을(를) 인코딩/디코딩 합니다.')
    .addStringOption(o =>
      o.setName('모드')
       .setDescription('인코딩(e) 또는 디코딩(d)')
       .addChoices(
         { name: '인코딩', value: 'e' },
         { name: '디코딩', value: 'd' }
       )
       .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('값')
       .setDescription('처리할 문자열')
       .setRequired(true)
    ),

  async execute(interaction) {
    const mode = interaction.options.getString('모드');
    const text = interaction.options.getString('값');
    const output = mode === 'd'
      ? Buffer.from(text, 'base64').toString('utf8')
      : Buffer.from(text).toString('base64');

    await interaction.reply(output);
  },
};