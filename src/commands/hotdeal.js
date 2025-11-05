import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../logger.js';

// 에펨코리아 핫딜 URL
const FMKOREA_HOTDEAL_URL = 'https://www.fmkorea.com/hotdeal';

// 핫딜 Embed 생성 함수
export async function fetchHotdealEmbed() {
  try {
    logger.info('[Hotdeal] 에펨코리아 핫딜 데이터 가져오는 중...');
    
    const response = await axios.get(FMKOREA_HOTDEAL_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0'
      },
      timeout: 10000 // 10초 타임아웃
    });

    const $ = cheerio.load(response.data);
    const deals = [];

    // 에펨코리아 핫딜 게시물 파싱
    $('.fm_best_widget li, .hotdeal_var8 li, .bd_lst li').each((index, element) => {
      if (index >= 15) return false; // 상위 15개만 수집

      const $element = $(element);
      
      // 제목과 링크 추출
      const titleElement = $element.find('a[href*="/hotdeal/"], .title a, h3 a, .bd_tit a');
      let title = titleElement.text().trim();
      const link = titleElement.attr('href');
      
      // 가격 정보 추출
      const priceElement = $element.find('.price, .won, .hotdeal_var8_price');
      const price = priceElement.text().trim() || '';
      
      // 쇼핑몰/출처 정보 추출
      const shopElement = $element.find('.shop, .site, .hotdeal_var8_site');
      const shop = shopElement.text().trim() || '';
      
      // 시간 정보 추출
      const timeElement = $element.find('.time, .date, .hotdeal_var8_date, .bd_time');
      const time = timeElement.text().trim() || '';
      
      // 추천수 추출
      const likeElement = $element.find('.like, .recommend, .bd_like');
      const likes = likeElement.text().trim().replace(/[^0-9]/g, '') || '0';
      
      // 댓글수 추출
      const commentElement = $element.find('.comment, .reply, .bd_reply');
      const comments = commentElement.text().trim().replace(/[^0-9]/g, '') || '0';

      if (title && title !== '') {
        // 제목 길이 제한
        if (title.length > 80) {
          title = title.substring(0, 77) + '...';
        }
        
        deals.push({
          title,
          link: link ? (link.startsWith('http') ? link : `https://www.fmkorea.com${link}`) : FMKOREA_HOTDEAL_URL,
          price: price || '가격정보 없음',
          shop: shop || '쇼핑몰 정보 없음',
          time: time || '방금',
          likes: likes || '0',
          comments: comments || '0'
        });
      }
    });

    // 대체 파싱 방법 (첫 번째가 실패할 경우)
    if (deals.length === 0) {
      logger.info('[Hotdeal] 기본 선택자로 파싱 실패, 대체 선택자 시도...');
      
      $('li, .list-item, .item, article').each((index, element) => {
        if (index >= 20) return false;
        
        const $element = $(element);
        const titleLink = $element.find('a').first();
        const title = titleLink.text().trim();
        const link = titleLink.attr('href');
        
        if (title && title.length > 5 && link && link.includes('hotdeal')) {
          deals.push({
            title: title.length > 80 ? title.substring(0, 77) + '...' : title,
            link: link.startsWith('http') ? link : `https://www.fmkorea.com${link}`,
            price: '가격확인필요',
            shop: '에펨코리아',
            time: '최근',
            likes: '0',
            comments: '0'
          });
        }
      });
    }

    if (deals.length === 0) {
      logger.warn('[Hotdeal] 파싱된 핫딜 데이터가 없습니다. 페이지 구조가 변경되었을 수 있습니다.');
      return createFallbackEmbed();
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF4757)
      .setTitle('🔥 에펨코리아 핫딜 정보')
      .setURL(FMKOREA_HOTDEAL_URL)
      .setDescription('최신 핫딜 정보를 확인해보세요!')
      .setTimestamp()
      .setFooter({ text: '에펨코리아 핫딜 - www.fmkorea.com/hotdeal' });

    // 상위 5개 핫딜만 표시
    const topDeals = deals.slice(0, 5);
    topDeals.forEach((deal, index) => {
      let fieldValue = '';
      
      if (deal.price && deal.price !== '가격정보 없음') {
        fieldValue += `💰 **${deal.price}**\n`;
      }
      
      if (deal.shop && deal.shop !== '쇼핑몰 정보 없음') {
        fieldValue += `🏪 ${deal.shop}\n`;
      }
      
      fieldValue += `🕒 ${deal.time}`;
      
      if (deal.likes !== '0') {
        fieldValue += ` | 👍 ${deal.likes}`;
      }
      
      if (deal.comments !== '0') {
        fieldValue += ` | 💬 ${deal.comments}`;
      }
      
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
    logger.error('[Hotdeal] 에펨코리아 핫딜 데이터 가져오기 실패:', error.message);
    return createFallbackEmbed();
  }
}

// 대체 Embed 생성 함수
function createFallbackEmbed() {
  const embed = new EmbedBuilder()
    .setColor(0xFF4757)
    .setTitle('🔥 에펨코리아 핫딜')
    .setURL(FMKOREA_HOTDEAL_URL)
    .setDescription('현재 핫딜 정보를 자동으로 가져올 수 없습니다.\n아래 링크를 통해 직접 확인해주세요!')
    .addFields({
      name: '📱 핫딜 페이지 바로가기',
      value: '[에펨코리아 핫딜](https://www.fmkorea.com/hotdeal)\n\n최신 할인 정보, 특가 상품, 무료 나눔 등을\n실시간으로 확인하실 수 있습니다.',
      inline: false
    })
    .addFields({
      name: '💡 이용 팁',
      value: '• 인기글 탭에서 검증된 핫딜 확인\n• 댓글을 통한 후기 및 정보 교환\n• 마감 임박 딜은 빠른 결정 필요\n• 가격 비교를 통한 현명한 소비',
      inline: false
    })
    .setTimestamp()
    .setFooter({ text: '에펨코리아 핫딜 - 일시적 접근 제한' });

  return embed;
}

export default {
  data: new SlashCommandBuilder()
    .setName('핫딜')
    .setDescription('에펨코리아의 최신 핫딜 정보를 가져옵니다.'),

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