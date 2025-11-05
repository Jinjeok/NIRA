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
const BUTTON_TTL_SEC = 60; // 버튼 유효기간 60초

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
  return `- [**${title}**](${link})`;
}

function buildBodyLine(item) {
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
    throw e;
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

function buildComponents(pageIndex, totalPages, issuedAtSec) {
  const prevDisabled = pageIndex <= 0;
  const nextDisabled = pageIndex >= totalPages - 1;
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`hotdeal_prev:${pageIndex}:${issuedAtSec}`)
        .setLabel('이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(prevDisabled),
      new ButtonBuilder()
        .setCustomId(`hotdeal_next:${pageIndex}:${issuedAtSec}`)
        .setLabel('다음')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(nextDisabled)
    )
  ];
}

export async function buildHotdealEmbedAndComponents(pageIndex = 0, withButtons = true, issuedAtSec = null) {
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

    const ts = issuedAtSec ?? Math.floor(Date.now() / 1000);
    const components = withButtons ? buildComponents(clampedPage, totalPages, ts) : [];
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

function removeButtonsFrom(components) {
  // 모든 버튼 컴포넌트를 제거하여 클릭 자체를 불가능하게 만듭니다.
  return []; // Discord는 빈 배열 전달 시 컴포넌트를 제거합니다.
}

export async function fetchHotdealEmbed() {
  const { embed } = await buildHotdealEmbedAndComponents(0, false);
  return embed;
}

export default {
  data: new SlashCommandBuilder()
    .setName('핫딜')
    .setDescription('뽐뿌 핫딜(RSS)에서 최신 핫딜을 보여줍니다.'),

  async execute(interaction) {
    await interaction.deferReply();
    const issuedAtSec = Math.floor(Date.now() / 1000);
    const { embed, components } = await buildHotdealEmbedAndComponents(0, true, issuedAtSec);
    // 60초 뒤 자동으로 버튼 제거 스케줄
    setTimeout(async () => {
      try {
        const msg = await interaction.fetchReply();
        await interaction.editReply({ components: removeButtonsFrom(msg.components) });
      } catch (e) {
        logger.warn('[Hotdeal] 자동 만료(버튼 제거) 중 오류:', e?.message || e);
      }
    }, BUTTON_TTL_SEC * 1000);
    await interaction.editReply({ embeds: [embed], components });
  },

  async handleComponent(interaction) {
    const cid = interaction.customId || '';
    if (!(cid.startsWith('hotdeal_prev:') || cid.startsWith('hotdeal_next:'))) return;

    try { await interaction.deferUpdate(); } catch {}

    const parts = cid.split(':');
    const key = parts[0];
    const pageStr = parts[1];
    const issuedAtSec = parseInt(parts[2] || '0', 10) || 0;

    const nowSec = Math.floor(Date.now() / 1000);
    const expired = issuedAtSec && (nowSec - issuedAtSec >= BUTTON_TTL_SEC);

    if (expired) {
      // 만료: 버튼을 완전히 제거
      const msg = await interaction.fetchReply();
      try {
        await interaction.editReply({ components: removeButtonsFrom(msg.components) });
      } catch (e) {
        try { await interaction.update({ components: [] }); } catch (e2) {
          logger.error('[Hotdeal] 만료시 버튼 제거 실패:', e2);
        }
      }
      return;
    }

    const current = parseInt(pageStr || '0', 10) || 0;
    const delta = key === 'hotdeal_next' ? 1 : -1;
    const nextPage = current + delta;

    const { embed, components } = await buildHotdealEmbedAndComponents(nextPage, true, issuedAtSec);

    try {
      await interaction.editReply({ embeds: [embed], components });
    } catch (e) {
      try { await interaction.update({ embeds: [embed], components }); } catch (e2) {
        logger.error('[Hotdeal] 버튼 상호작용 업데이트 실패:', e2);
      }
    }
  },
};