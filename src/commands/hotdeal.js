import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../logger.js';

// 아르카 라이브 핫딜 채널 URL
const ARCA_HOTDEAL_URL = 'https://arca.live/b/hotdeal';

// 핫딜 Embed 생성 함수
export async function fetchHotdealEmbed() {
  try {
    logger.info('[Hotdeal] 아르카 라이브 핫딜 데이터 가져오는 중...');
    
    const response = await axios.get(ARCA_HOTDEAL_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      },
      timeout: 10000 // 10초 타임아웃
    });

    // Cloudflare 보안 검사 페이지인지 확인
    if (response.data.includes('Just a moment...') || response.data.includes('_cf_chl_opt')) {
      logger.warn('[Hotdeal] Cloudflare 보안 검사 페이지 감지됨. 대체 방법 사용.');
      return createFallbackEmbed();
    }

    const $ = cheerio.load(response.data);
    const deals = [];

    // 아르카 라이브의 게시물 구조에 맞게 파싱
    $('.vrow').each((index, element) => {
      if (index >= 10) return false; // 상위 10개만
      
      const $element = $(element);
      const titleElement = $element.find('.title a');
      const title = titleElement.text().trim();
      const link = titleElement.attr('href');
      const author = $element.find('.user-info .nick').text().trim();
      const time = $element.find('.col-time').text().trim();
      const viewCount = $element.find('.col-view').text().trim() || '0';
      const likeCount = $element.find('.col-rate').text().trim() || '0';
      
      if (title && title !== '') {
        deals.push({
          title: title.length > 100 ? title.substring(0, 97) + '...' : title,
          link: link ? (link.startsWith('http') ? link : `https://arca.live${link}`) : ARCA_HOTDEAL_URL,
          author: author || '익명',
          time: time || '방금',
          views: viewCount,
          likes: likeCount
        });
      }
    });

    if (deals.length === 0) {
      logger.warn('[Hotdeal] 파싱된 핫딜 데이터가 없습니다. 페이지 구조가 변경되었을 수 있습니다.');
      return createFallbackEmbed();
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('🔥 아르카 라이브 핫딜 정보')
      .setURL(ARCA_HOTDEAL_URL)
      .setDescription('최신 핫딜 정보를 확인해보세요!')
      .setTimestamp()
      .setFooter({ text: '아르카 라이브 핫딜 채널 - arca.live/b/hotdeal' });

    // 상위 5개 핫딜만 표시
    const topDeals = deals.slice(0, 5);
    topDeals.forEach((deal, index) => {
      let fieldValue = `👤 작성자: ${deal.author}\n🕐 시간: ${deal.time}`;
      if (deal.views) fieldValue += `\n👀 조회: ${deal.views}`;
      if (deal.likes) fieldValue += ` | 👍 추천: ${deal.likes}`;
      fieldValue += `\n[게시글 바로가기](${deal.link})`;
      
      embed.addFields({
        name: `${index + 1}. ${deal.title}`,
        value: fieldValue,
        inline: false
      });
    });

    logger.info(`[Hotdeal] ${deals.length}개의 핫딜 정보를 성공적으로 가져왔습니다.`);
    return embed;

  } catch (error) {
    logger.error('[Hotdeal] 아르카 라이브 핫딜 데이터 가져오기 실패:', error.message);
    return createFallbackEmbed();
  }
}

// 대체 Embed 생성 함수
function createFallbackEmbed() {
  const embed = new EmbedBuilder()
    .setColor(0xFF6B6B)
    .setTitle('🔥 아르카 라이브 핫딜')
    .setURL(ARCA_HOTDEAL_URL)
    .setDescription('현재 핫딜 정보를 자동으로 가져올 수 없습니다.\n아래 링크를 통해 직접 확인해주세요!')
    .addFields({
      name: '📱 핫딜 채널 바로가기',
      value: '[아르카 라이브 핫딜 채널](https://arca.live/b/hotdeal)\n\n최신 핫딜, 할인 정보, 무료 나눔 등을\n실시간으로 확인하실 수 있습니다.',
      inline: false
    })
    .addFields({
      name: '💡 이용 팁',
      value: '• 인기글 탭에서 검증된 핫딜 확인\n• 댓글을 통한 후기 및 정보 교환\n• 마감 임박 딜은 빠른 결정 필요',
      inline: false
    })
    .setTimestamp()
    .setFooter({ text: '아르카 라이브 핫딜 채널 - 일시적 접근 제한' });

  return embed;
}

export default {
  data: new SlashCommandBuilder()
    .setName('핫딜')
    .setDescription('아르카 라이브의 최신 핫딜 정보를 가져옵니다.'),

  async execute(interaction) {
    await interaction.deferReply();
    
    const embed = await fetchHotdealEmbed();
    
    if (embed) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({ 
        content: '핫딜 정보를 가져오는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
        ephemeral: true 
      });
    }
  },

  // 스케줄링된 작업에서 사용할 수 있도록 함수를 내보냅니다.
  fetchHotdealEmbed,
};