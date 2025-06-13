import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('트위터')
    .setDescription('X 또는 Twitter 링크를 vxtwitter 링크로 변환합니다.')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('변환할 X 또는 Twitter 링크')
        .setRequired(true)
    ),

  async execute(interaction) {
    const originalUrl = interaction.options.getString('url');
    let convertedUrl = originalUrl;

    // URL 유효성 검사 및 변환 로직
    try {
      const urlObject = new URL(originalUrl);
      const hostname = urlObject.hostname.toLowerCase();
      const pathname = urlObject.pathname;

      if ((hostname === 'x.com' || hostname === 'twitter.com') && pathname.includes('/status/')) {
        convertedUrl = `https://vxtwitter.com${pathname}${urlObject.search}${urlObject.hash}`;

        await interaction.reply({ content: convertedUrl});

      } else {
        await interaction.reply({ content: '올바른 X.com 또는 Twitter.com 게시물 링크를 입력해주세요. (예: https://x.com/username/status/12345)', flags: MessageFlags.Ephemeral });
      }
    } catch (error) {
      // URL 파싱 중 오류 발생 시 (잘못된 URL 형식 등)
      await interaction.reply({ content: '유효하지 않은 URL 형식입니다. 올바른 링크를 입력해주세요.', flags: MessageFlags.Ephemeral });
    }
  },
};