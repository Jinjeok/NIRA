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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const deals = [];

    // 핫딜 게시물 파싱 (상위 10개)
    $('.vrow').slice(0, 10).each((index, element) => {
      const title = $(element).find('.title').text().trim();
      const price = $(element).find('.deal-price').text().trim() || '가격 정보 없음';
      const link = 'https://arca.live' + $(element).find('a').attr('href');
      const views = $(element).find('.view-count').text().trim() || '0';
      const likes = $(element).find('.like-count').text().trim() || '0';
      
      if (title && title !== '') {
        deals.push({
          title: title.length > 100 ? title.substring(0, 97) + '...' : title,
          price,
          link,
          views,
          likes
        });
      }
    });

    if (deals.length === 0) {
      logger.warn('[Hotdeal] 파싱된 핫딜 데이터가 없습니다.');
      return null;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('🔥 아르카 라이브 핫딜 정보')
      .setURL(ARCA_HOTDEAL_URL)
      .setDescription('최신 핫딜 정보를 확인해보세요!')
      .setTimestamp()
      .setFooter({ text: '아르카 라이브 핫딜 채널 - arca.live/b/hotdeal' });

    // 상위 5개 핫딜만 표시
    deals.slice(0, 5).forEach((deal, index) => {
      embed.addFields({
        name: `${index + 1}. ${deal.title}`,
        value: `💰 **${deal.price}**\n👀 조회수: ${deal.views} | 👍 추천: ${deal.likes}\n[링크 바로가기](${deal.link})`,
        inline: false
      });
    });

    logger.info(`[Hotdeal] ${deals.length}개의 핫딜 정보를 성공적으로 가져왔습니다.`);
    return embed;

  } catch (error) {
    logger.error('[Hotdeal] 아르카 라이브 핫딜 데이터 가져오기 실패:', error.message);
    
    // 기본 메시지로 대체
    const fallbackEmbed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('🔥 아르카 라이브 핫딜')
      .setURL(ARCA_HOTDEAL_URL)
      .setDescription('현재 핫딜 정보를 가져올 수 없습니다. 직접 사이트를 확인해주세요.')
      .addFields({
        name: '핫딜 채널 바로가기',
        value: '[아르카 라이브 핫딜 채널](https://arca.live/b/hotdeal)',
        inline: false
      })
      .setTimestamp()
      .setFooter({ text: '아르카 라이브 핫딜 채널' });

    return fallbackEmbed;
  }
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