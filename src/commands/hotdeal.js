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
  const body = truncate(item.contentSnippet || item.content || item.summary || '', 30); // 30자 제한
  return `[${body || '게시글 보기'}](${link})`;
}

function renderPage(items, pageIndex) {
  const start = pageIndex * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const slice = items.slice(start, end);
  const lines = slice.map((item) => {
    const titleLine = buildTitleLine(item);
    const bodyLine = buildBodyLine(item);
    return `- ${titleLine}\n${bodyLine}`; // 번호 대신 대시 사용
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

async function fetchRssItems() {
  const feed = await parser.parseURL(PPOMPPU_RSS);
  const items = feed?.items || [];
  const limited = items.slice(0, PAGE_SIZE * MAX_PAGES);
  return { items: limited, totalPages: Math.max(1, Math.ceil(limited.length / PAGE_SIZE)) };
}

export async function buildHotdealEmbedAndComponents(pageIndex = 0) {
  try {
    const { items, totalPages } = await fetchRssItems();
    const clampedPage = Math.min(Math.max(0, pageIndex), totalPages - 1);

    const embed = new EmbedBuilder()
      .setColor(0xFF8800)
      .setTitle('🔥 뽐뿌 핫딜 (RSS)')
      .setURL('https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu')
      .setDescription(renderPage(items, clampedPage))
      .setFooter({ text: `페이지 ${clampedPage + 1} / ${totalPages}` })
      .setTimestamp();

    const components = buildComponents(clampedPage, totalPages);
    return { embed, components };
  } catch (err) {
    logger.error('[Hotdeal] RSS 파싱 실패:', err);
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
  const { embed } = await buildHotdealEmbedAndComponents(0);
  return embed; // 스케줄러 호환 유지(컴포넌트는 스케줄러에서 따로 지정하지 않음)
}

export default {
  data: new SlashCommandBuilder()
    .setName('핫딜')
    .setDescription('뽐뿌 핫딜(RSS)에서 최신 핫딜을 보여줍니다.'),

  async execute(interaction) {
    await interaction.deferReply();
    const { embed, components } = await buildHotdealEmbedAndComponents(0);
    await interaction.editReply({ embeds: [embed], components });
  },

  // 버튼 상호작용 핸들러(스케줄러/명령 모두 재사용 가능)
  async handleComponent(interaction) {
    if (!interaction.isButton()) return;
    const [key, pageStr] = (interaction.customId || '').split(':');
    if (key !== 'hotdeal_prev' && key !== 'hotdeal_next') return;

    const current = parseInt(pageStr || '0', 10) || 0;
    const delta = key === 'hotdeal_next' ? 1 : -1;
    const nextPage = current + delta;

    const { embed, components } = await buildHotdealEmbedAndComponents(nextPage);
    await interaction.update({ embeds: [embed], components });
  },
};
