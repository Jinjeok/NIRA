import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import Parser from 'rss-parser';
import logger from '../logger.js';

const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NIRA/1.0; +https://github.com/Jinjeok/NIRA)' },
  timeout: 10000,
});

const PPOMPPU_RSS = 'https://www.ppomppu.co.kr/rss.php?id=ppomppu';

function truncateClean(htmlOrText = '', len = 220) {
  const text = (htmlOrText || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
  return text.length > len ? text.slice(0, len - 3) + '...' : text;
}

export async function fetchHotdealEmbed() {
  try {
    logger.info('[Hotdeal] 뽐뿌 RSS 수집...');
    const feed = await parser.parseURL(PPOMPPU_RSS);
    if (!feed?.items?.length) {
      logger.warn('[Hotdeal] RSS 항목 없음');
      return createFallbackEmbed();
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF8800)
      .setTitle('🔥 뽐뿌 핫딜 (RSS)') // 제목 현상 유지
      .setURL('https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu')
      .setTimestamp();

    // 상위 5개: 필드 대신 본문(description)만, 각 항목은 클릭 가능한 링크 형태로 구성
    const items = feed.items.slice(0, 5);
    const lines = items.map((item, idx) => {
      const title = (item.title || '').trim();
      const link = item.link || 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';
      const body = truncateClean(item.contentSnippet || item.content || item.summary || '', 220);
      // 본문을 클릭 시 바로 링크되도록: 마크다운 링크를 본문에 적용
      const clickable = `[${body || (title || '게시글 보기')}](${link})`;
      return `${idx + 1}. ${clickable}`;
    });

    embed.setDescription(lines.join('\n\n'));

    return embed;
  } catch (err) {
    logger.error('[Hotdeal] RSS 파싱 실패:', err);
    return createFallbackEmbed();
  }
}

function createFallbackEmbed() {
  return new EmbedBuilder()
    .setColor(0xFF8800)
    .setTitle('🔥 뽐뿌 핫딜 (RSS)')
    .setURL('https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu')
    .setDescription('[최신 핫딜을 여기에서 확인하세요](https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu)')
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
