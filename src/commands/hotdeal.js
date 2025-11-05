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

// 제목 생성 규칙: [몰] 제목 (가격/배송)
function buildTitleLine(item) {
  const rawTitle = clean(item.title || '');
  // 제목에서 쇼핑몰/가격/배송 힌트가 섞여 있을 수 있으므로 패턴 분리 시도
  // 예: "[하이마트몰] 로라스타 IGGI 스티머 스팀다리미 (259,470원/무료)"
  // RSS 제목 자체를 1차로 사용하되, 글자수 제한 적용
  return truncate(rawTitle, 90);
}

// 본문 라인: [요약 본문](링크)
function buildBodyLine(item) {
  const link = item.link || 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';
  const body = truncate(item.contentSnippet || item.content || item.summary || '', 120);
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

    const items = feed.items.slice(0, 5);
    const lines = items.map((item, idx) => {
      const titleLine = buildTitleLine(item);
      const bodyLine = buildBodyLine(item);
      return `${idx + 1}. ${titleLine}\n${bodyLine}`;
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
