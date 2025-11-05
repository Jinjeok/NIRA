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

async function fetchRssItems() {
  const feed = await parser.parseURL(PPOMPPU_RSS);
  const items = feed?.items || [];
  const limited = items.slice(0, PAGE_SIZE * MAX_PAGES);
  const totalPages = Math.max(1, Math.ceil(limited.length / PAGE_SIZE));
  return { items: limited, totalPages };
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

export async function buildHotdealEmbedAndComponents(pageIndex = 0, withButtons = true) {
  const { items, totalPages } = await fetchRssItems();
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

  // 버튼 상호작용 핸들러: index.js 수정 없이 src만으로 처리 (reply/update는 여기서만 수행)
  async handleComponent(interaction) {
    const cid = interaction.customId || '';
    if (!(cid.startsWith('hotdeal_prev:') || cid.startsWith('hotdeal_next:'))) return;

    // 3초 제한 방지: 먼저 update를 예약(deferUpdate) 후 편집
    try {
      await interaction.deferUpdate();
    } catch (e) {
      // 이미 defer되었거나 응답된 경우는 무시
    }

    const [key, pageStr] = cid.split(':');
    const current = parseInt(pageStr || '0', 10) || 0;
    const delta = key === 'hotdeal_next' ? 1 : -1;
    const nextPage = current + delta;

    const { embed, components } = await buildHotdealEmbedAndComponents(nextPage, true);

    // index.js 변경 없이, 여기서 editReply 수행
    try {
      await interaction.editReply({ embeds: [embed], components });
    } catch (e) {
      // editReply 실패 시 update로 시도 (일부 환경 호환)
      try {
        await interaction.update({ embeds: [embed], components });
      } catch (e2) {
        // 최종 실패는 로그만
        logger.error('[Hotdeal] 버튼 상호작용 업데이트 실패:', e2);
      }
    }
  },
};
