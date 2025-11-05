import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import Parser from 'rss-parser';
import logger from '../logger.js';

const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NIRA/1.0; +https://github.com/Jinjeok/NIRA)' },
  timeout: 10000,
});

const PPOMPPU_RSS = 'https://www.ppomppu.co.kr/rss.php?id=ppomppu';

function clean(text = '') {
  return (text || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
}
function truncate(text = '', len) {
  const t = clean(text);
  return t.length > len ? t.slice(0, len - 1) + '…' : t;
}

function buildTitleLine(item) {
  const rawTitle = clean(item.title || '');
  return truncate(rawTitle, 90);
}

function buildBodyLine(item) {
  const link = item.link || 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';
  const body = truncate(item.contentSnippet || item.content || item.summary || '', 30); // 본문 30자 제한
  return `[${body || '게시글 보기'}](${link})`;
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
      .setTitle('🔥 뽐뿌 핫딜 (RSS)')
      .setURL('https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu')
      .setTimestamp();

    // 간격을 줄이기 위해 항목 사이 공백 제거 (줄바꿈 1개만)
    const items = feed.items.slice(0, 5);
    const lines = items.map((item, idx) => {
      const titleLine = buildTitleLine(item);
      const bodyLine = buildBodyLine(item);
      return `${idx + 1}. ${titleLine}\n${bodyLine}`;
    });

    embed.setDescription(lines.join('\n')); // 항목 사이 공백 줄 제거
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
