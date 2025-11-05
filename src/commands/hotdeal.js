import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import Parser from 'rss-parser';
import logger from '../logger.js';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; NIRA/1.0; +https://github.com/Jinjeok/NIRA)'
  }
});

// 뽐뿌 핫딜 RSS URL (뽐뿌게시판)
const PPOMPPU_RSS = 'https://www.ppomppu.co.kr/rss.php?id=ppomppu';

function truncate(text = '', len = 180) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > len ? clean.slice(0, len - 3) + '...' : clean;
}

export async function fetchHotdealEmbed() {
  try {
    logger.info('[Hotdeal] 뽐뿌 RSS에서 핫딜 수집 중...');
    const feed = await parser.parseURL(PPOMPPU_RSS);

    if (!feed?.items?.length) {
      logger.warn('[Hotdeal] RSS 항목이 비어있습니다.');
      return createFallbackEmbed();
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF8800)
      .setTitle('🔥 뽐뿌 핫딜 (RSS)')
      .setURL('https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu')
      .setTimestamp()
      .setFooter({ text: '출처: 뽐뿌 핫딜 (RSS)' });

    const top = feed.items.slice(0, 5);
    top.forEach((item, idx) => {
      const title = truncate(item.title || '제목 없음', 100);
      const desc = truncate(item.contentSnippet || item.content || item.summary || '', 230);
      const link = item.link || 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';
      const author = item.creator || item.author || (item.dc && item.dc.creator) || '';
      const pubDate = item.pubDate ? new Date(item.pubDate).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '';

      let value = '';
      if (author) value += `👤 ${author}`;
      if (pubDate) value += (value ? ' | ' : '') + `🕒 ${pubDate}`;
      if (desc) value += `\n${desc}`;
      value += `\n[게시글 보기](${link})`;

      embed.addFields({ name: `${idx + 1}. ${title}`, value, inline: false });
    });

    return embed;
  } catch (err) {
    logger.error('[Hotdeal] 뽐뿌 RSS 파싱 실패:', err);
    return createFallbackEmbed();
  }
}

function createFallbackEmbed() {
  return new EmbedBuilder()
    .setColor(0xFF8800)
    .setTitle('🔥 뽐뿌 핫딜')
    .setURL('https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu')
    .setDescription('현재 자동 수집에 문제가 있습니다. 링크를 통해 최신 핫딜을 확인해주세요.')
    .setTimestamp();
}

export default {
  data: new SlashCommandBuilder()
    .setName('핫딜')
    .setDescription('뽐뿌 핫딜(RSS)에서 최신 핫딜을 보여줍니다.'),

  async execute(interaction) {
    await interaction.deferReply();
    const embed = await fetchHotdealEmbed();
    await interaction.editReply({ embeds: [embed] });
  },

  fetchHotdealEmbed,
};
