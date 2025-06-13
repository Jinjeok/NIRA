import { SlashCommandBuilder } from '@discordjs/builders';

export default {
  data: new SlashCommandBuilder()
    .setName('메시지삭제')
    .setDescription('채널 메시지 일괄 삭제')
    .addIntegerOption(o =>
      o.setName('amount')
       .setDescription('삭제할 메시지 수')
       .setRequired(true)
    ),

  async execute(interaction) {
    const cnt = interaction.options.getInteger('amount');
    await interaction.channel.bulkDelete(cnt, true);
    await interaction.reply({ content: `${cnt}개의 메시지를 삭제했습니다.` });
  },
};