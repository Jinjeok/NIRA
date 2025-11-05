import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import Parser from 'rss-parser';
import logger from '../logger.js';

const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NIRA/1.0; +https://github.com/Jinjeok/NIRA)' },
  timeout: 10000,
});

const PPOMPPU_RSS = 'https://www.ppomppu.co.kr/rss.php?id=ppomppu';
const PAGE_SIZE = 5;
const MAX_PAGES = 10; // 최대 10페이지 (최대 50개 항목)
const CACHE_TTL_MS = 60 * 1000; // 60초 캐시

let _cache = { ts: 0, items: [], totalPages: 1 };

function clean(text = '') {
  return (text || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
}
function truncate(text = '', len) {
  const t = clean(text);
  return t.length > len ? t.slice(0, len - 1) + '…' : t;
}

function buildTitleLine(item) {
  const rawTitle = clean(item.title || '');
  const title = truncate(rawTitle, 90);
  const link = item.link || 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';
  // 제목 굵게 + 제목에만 링크
  return `- [**${title}**](${link})`;
}

function buildBodyLine(item) {
  // 본문 링크 제거, 30자 요약만 표시
  const body = truncate(item.contentSnippet || item.content || item.summary || '', 30);
  return `${body}`;
}

async function fetchRssItemsFresh() {
  const feed = await parser.parseURL(PPOMPPU_RSS);
  const items = feed?.items || [];
  const limited = items.slice(0, PAGE_SIZE * MAX_PAGES);
  const totalPages = Math.max(1, Math.ceil(limited.length / PAGE_SIZE));
  return { items: limited, totalPages };
}

async function getCachedItems() {
  const now = Date.now();
  if (now - _cache.ts <= CACHE_TTL_MS && _cache.items.length) {
    return { items: _cache.items, totalPages: _cache.totalPages };
  }
  try {
    const fresh = await fetchRssItemsFresh();
    _cache = { ts: now, items: fresh.items, totalPages: fresh.totalPages };
    return fresh;
  } catch (e) {
    logger.warn('[Hotdeal] RSS 갱신 실패, 캐시 사용 시도:', e?.message || e);
    if (_cache.items.length) return { items: _cache.items, totalPages: _cache.totalPages };
    throw e; // 캐시도 없으면 상위에서 폴백 처리
  }
}

function renderPage(items, pageIndex) {
  const start = pageIndex * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const slice = items.slice(start, end);
  const lines = slice.map((item) => {
    const titleLine = buildTitleLine(item);
    const bodyLine = buildBodyLine(item);
    return `${titleLine}\n${bodyLine}`;
  });
  return lines.join('\n');
}

function buildComponents(pageIndex, totalPages) {
  const prevDisabled = pageIndex <= 0;
  const nextDisabled = pageIndex >= totalPages - 1;
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`hotdeal_prev:${pageIndex}`)
        .setLabel('이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(prevDisabled),
      new ButtonBuilder()
        .setCustomId(`hotdeal_next:${pageIndex}`)
        .setLabel('다음')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(nextDisabled)
    )
  ];
}

export async function buildHotdealEmbedAndComponents(pageIndex = 0, withButtons = true) {
  try {
    const { items, totalPages } = await getCachedItems();
    const clampedPage = Math.min(Math.max(0, pageIndex), totalPages - 1);

    const embed = new EmbedBuilder()
      .setColor(0xFF8800)
      .setTitle('🔥 뽐뿌 핫딜 (RSS)')
      .setURL('https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu')
      .setDescription(renderPage(items, clampedPage))
      .setFooter({ text: `페이지 ${clampedPage + 1} / ${totalPages}` })
      .setTimestamp();

    const components = withButtons ? buildComponents(clampedPage, totalPages) : [];
    return { embed, components };
  } catch (err) {
    logger.error('[Hotdeal] RSS 파싱/캐시 실패:', err);
    const fallback = new EmbedBuilder()
      .setColor(0xFF8800)
      .setTitle('🔥 뽐뿌 핫딜 (RSS)')
      .setURL('https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu')
      .setDescription('[최신 핫딜을 여기에서 확인하세요](https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu)')
      .setTimestamp();
    return { embed: fallback, components: [] };
  }
}

export async function fetchHotdealEmbed() {
  // 스케줄러 용: 버튼 없이 embed만 반환
  const { embed } = await buildHotdealEmbedAndComponents(0, false);
  return embed;
}

export default {
  data: new SlashCommandBuilder()
    .setName('핫딜')
    .setDescription('뽐뿌 핫딜(RSS)에서 최신 핫딜을 보여줍니다.'),

  async execute(interaction) {
    await interaction.deferReply();
    const { embed, components } = await buildHotdealEmbedAndComponents(0, true);
    await interaction.editReply({ embeds: [embed], components });
  },

  async handleComponent(interaction) {
    const cid = interaction.customId || '';
    if (!(cid.startsWith('hotdeal_prev:') || cid.startsWith('hotdeal_next:'))) return;

    try { await interaction.deferUpdate(); } catch {}

    const [key, pageStr] = cid.split(':');
    const current = parseInt(pageStr || '0', 10) || 0;
    const delta = key === 'hotdeal_next' ? 1 : -1;
    const nextPage = current + delta;

    const { embed, components } = await buildHotdealEmbedAndComponents(nextPage, true);

    try {
      await interaction.editReply({ embeds: [embed], components });
    } catch (e) {
      try { await interaction.update({ embeds: [embed], components }); } catch (e2) {
        logger.error('[Hotdeal] 버튼 상호작용 업데이트 실패:', e2);
      }
    }
  },
};