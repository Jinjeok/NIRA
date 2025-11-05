import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import Parser from 'rss-parser';
import logger from '../logger.js';

const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NIRA/1.0; +https://github.com/Jinjeok/NIRA)' },
  timeout: 10000,
});

const PPOMPPU_RSS = 'https://www.ppomppu.co.kr/rss.php?id=ppomppu';
const PAGE_SIZE = 5;            // 명령어용 페이지 크기
const SCHEDULER_SIZE = 15;      // 스케줄러용 항목 수
const MAX_PAGES = 10;           // 최대 10페이지 (최대 50개 항목)
const CACHE_TTL_MS = 60 * 1000; // 60초 캐시
const BUTTON_TTL_SEC = 60;      // 버튼 유효기간 60초

let _cache = { ts: 0, items: [], totalPages: 1 };

function clean(text = '') { return (text || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim(); }
function truncate(text = '', len) { const t = clean(text); return t.length > len ? t.slice(0, len - 1) + '…' : t; }

function buildTitleLine(item) {
  const rawTitle = clean(item.title || '');
  const title = truncate(rawTitle, 90);
  const link = item.link || 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';
  return `- [**${title}**](${link})`;
}
function buildBodyLine(item) { const body = truncate(item.contentSnippet || item.content || item.summary || '', 30); return `${body}`; }

async function fetchRssItemsFresh() {
  const feed = await parser.parseURL(PPOMPPU_RSS);
  const items = feed?.items || [];
  // 전체 받아와서 캐시에 저장 (페이지 용도와 스케줄러 용도가 각각 슬라이스)
  const maxNeed = Math.max(SCHEDULER_SIZE, PAGE_SIZE * MAX_PAGES);
  const limited = items.slice(0, maxNeed);
  const totalPages = Math.max(1, Math.ceil(Math.min(limited.length, PAGE_SIZE * MAX_PAGES) / PAGE_SIZE));
  return { items: limited, totalPages };
}
async function getCachedItems() {
  const now = Date.now();
  if (now - _cache.ts <= CACHE_TTL_MS && _cache.items.length) return { items: _cache.items, totalPages: _cache.totalPages };
  try { const fresh = await fetchRssItemsFresh(); _cache = { ts: now, items: fresh.items, totalPages: fresh.totalPages }; return fresh; }
  catch (e) { logger.warn('[Hotdeal] RSS 갱신 실패, 캐시 사용 시도:', e?.message || e); if (_cache.items.length) return { items: _cache.items, totalPages: _cache.totalPages }; throw e; }
}

function renderLines(items) { return items.map(item => `${buildTitleLine(item)}\n${buildBodyLine(item)}`).join('\n'); }

function buildComponents(pageIndex, totalPages, issuedAtSec) {
  const prevDisabled = pageIndex <= 0;
  const nextDisabled = pageIndex >= totalPages - 1;
  return [ new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`hotdeal_prev:${pageIndex}:${issuedAtSec}`).setLabel('이전').setStyle(ButtonStyle.Secondary).setDisabled(prevDisabled),
    new ButtonBuilder().setCustomId(`hotdeal_next:${pageIndex}:${issuedAtSec}`).setLabel('다음').setStyle(ButtonStyle.Primary).setDisabled(nextDisabled)
  ) ];
}

export async function buildHotdealEmbedAndComponents(pageIndex = 0, withButtons = true, issuedAtSec = null) {
  try {
    const { items, totalPages } = await getCachedItems();
    const clampedPage = Math.min(Math.max(0, pageIndex), totalPages - 1);
    const start = clampedPage * PAGE_SIZE; const end = start + PAGE_SIZE;
    const pageItems = items.slice(start, end);

    const embed = new EmbedBuilder()
      .setColor(0xEE82EE)
      .setTitle('🔥 핫딜 정보')
      .setURL('https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu')
      .setDescription(renderLines(pageItems))
      .setFooter({ text: `페이지 ${clampedPage + 1} / ${totalPages}` })
      .setTimestamp();

    const ts = issuedAtSec ?? Math.floor(Date.now() / 1000);
    const components = withButtons ? buildComponents(clampedPage, totalPages, ts) : [];
    return { embed, components };
  } catch (err) {
    logger.error('[Hotdeal] RSS 파싱/캐시 실패:', err);
    const fallback = new EmbedBuilder().setColor(0xEE82EE).setTitle('🔥 핫딜 정보').setURL('https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu').setDescription('[최신 핫딜을 여기에서 확인하세요](https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu)').setTimestamp();
    return { embed: fallback, components: [] };
  }
}

export async function fetchHotdealEmbed() {
  // 스케줄러용: 15개를 한 번에 표시, 페이지/버튼 없음
  const { items } = await getCachedItems();
  const slice = items.slice(0, SCHEDULER_SIZE);
  const embed = new EmbedBuilder()
    .setColor(0xEE82EE)
    .setTitle('🔥 핫딜 정보')
    .setURL('https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu')
    .setDescription(renderLines(slice))
    .setTimestamp();
  return embed;
}

function removeButtonsFrom() { return []; }

export default {
  data: new SlashCommandBuilder().setName('핫딜').setDescription('뽐뿌 핫딜(RSS)에서 최신 핫딜을 보여줍니다.'),

  async execute(interaction) {
    await interaction.deferReply();
    const issuedAtSec = Math.floor(Date.now() / 1000);
    const { embed, components } = await buildHotdealEmbedAndComponents(0, true, issuedAtSec);
    setTimeout(async () => { try { await interaction.editReply({ components: removeButtonsFrom() }); } catch (e) { logger.warn('[Hotdeal] 자동 만료(버튼 제거) 중 오류:', e?.message || e); } }, BUTTON_TTL_SEC * 1000);
    await interaction.editReply({ embeds: [embed], components });
  },

  async handleComponent(interaction) {
    const cid = interaction.customId || '';
    if (!(cid.startsWith('hotdeal_prev:') || cid.startsWith('hotdeal_next:'))) return;
    try { await interaction.deferUpdate(); } catch {}
    const [key, pageStr, issuedStr] = cid.split(':');
    const issuedAtSec = parseInt(issuedStr || '0', 10) || 0;
    const nowSec = Math.floor(Date.now() / 1000);
    if (issuedAtSec && (nowSec - issuedAtSec >= BUTTON_TTL_SEC)) { try { await interaction.editReply({ components: removeButtonsFrom() }); } catch {} return; }
    const current = parseInt(pageStr || '0', 10) || 0; const delta = key === 'hotdeal_next' ? 1 : -1; const nextPage = current + delta;
    const { embed, components } = await buildHotdealEmbedAndComponents(nextPage, true, issuedAtSec);
    try { await interaction.editReply({ embeds: [embed], components }); } catch (e) { try { await interaction.update({ embeds: [embed], components }); } catch (e2) { logger.error('[Hotdeal] 버튼 상호작용 업데이트 실패:', e2); } }
  },
};