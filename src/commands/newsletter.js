const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Parser = require('rss-parser');
const parser = new Parser();
const logger = require('../logger'); // 로거가 있다면 사용

// 뉴스레터 피드 목록 (오브젝트-키 형식)
// 키: 사용자에게 보여질 선택지 이름
// 값: 해당 뉴스레터의 RSS 피드 URL
const newsletterFeeds = {
  "최신기사":"https://www.yna.co.kr/rss/news.xml",
  "스포츠": "https://www.yna.co.kr/rss/sports.xml",
  "정치": "https://www.yna.co.kr/rss/politics.xml",
  "경제": "https://www.yna.co.kr/rss/economy.xml",
  "문화": "https://www.yna.co.kr/rss/culture.xml",
  "사회": "https://www.yna.co.kr/rss/society.xml",
  "북한": "https://www.yna.co.kr/rss/northkorea.xml"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('뉴스레터') // 명령어 이름 변경
    .setDescription('선택한 종류의 뉴스레터를 가져와 보여줍니다.')
    .addStringOption(option => // 옵션 추가
      option.setName('분야')
        .setDescription('보고 싶은 뉴스레터 분야를 선택하세요.')
        .setRequired(true) // 필수 옵션으로 설정
        .addChoices(
          // newsletterFeeds 객체의 키를 사용하여 선택지를 동적으로 생성
          ...Object.keys(newsletterFeeds).map(key => ({ name: key, value: key }))
        )
    ),

  async execute(interaction) {
    const selectedCategory = interaction.options.getString('분야'); // 사용자가 선택한 종류 가져오기
    const rssUrl = newsletterFeeds[selectedCategory]; // 해당 종류의 RSS URL 가져오기

    if (!rssUrl) {
        // 이 경우는 addChoices에 의해 발생하기 어려우나, 방어적으로 처리
        await interaction.reply({ content: '선택한 종류의 뉴스레터 설정을 찾을 수 없습니다.', ephemeral: true });
        logger.warn(`뉴스레터: 유효하지 않은 종류 선택됨 - ${selectedCategory}`);
        return;
    }

    await interaction.deferReply(); // 뉴스레터 가져오는데 시간이 걸릴 수 있으므로 응답을 지연시킵니다.

    try {
      const feed = await parser.parseURL(rssUrl);

      if (!feed || !feed.items || feed.items.length === 0) {
        logger.warn(`뉴스레터: ${rssUrl} 에서 항목을 찾을 수 없습니다.`);
        await interaction.editReply({ content: `선택하신 '${selectedCategory}' 뉴스레터에서 새 항목을 찾을 수 없습니다.`, ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x0099FF) // 예시 색상    
        .setTitle(feed.title || `${selectedCategory} 뉴스`) // RSS 피드의 <channel> <title> 사용
        .setURL(feed.link) // RSS 피드의 <channel> <link> 사용
        .setTimestamp(feed.pubDate ? new Date(feed.pubDate) : new Date()) // RSS 피드의 발행일 또는 현재 시간
        .setFooter({ text: feed.copyright || `${selectedCategory} 뉴스 - 출처: ${new URL(rssUrl).hostname}` });

      // 최신 5개 항목만 필드로 추가 (Discord Embed 필드 제한 고려)
      const itemsToShow = feed.items.slice(0, 5);
      itemsToShow.forEach(item => {
        // contentSnippet (요약본) 또는 description (본문 일부) 사용
        let description = item.contentSnippet || item.content || item.description || '내용 없음';
        // 필드 값 길이 제한 (1024자) 및 가독성을 위해 200자로 제한
        if (description.length > 200) {
            description = description.substring(0, 197) + "...";
        }
        // HTML 태그 제거 (간단한 방식)
        description = description.replace(/<[^>]*>?/gm, '');

        embed.addFields({
          name: item.title ? (item.title.length > 250 ? item.title.substring(0, 247) + "..." : item.title) : '제목 없음', // 필드 이름 길이 제한
          value: `${description}`
        });
      });

      // 채널의 대표 이미지가 있다면 썸네일로 설정
      if (feed.image && feed.image.url) {
          embed.setThumbnail(feed.image.url);
      // 첫 번째 아이템에 이미지가 있다면 썸네일로 설정 (media:content 등)
      } else if (itemsToShow.length > 0 && itemsToShow[0].enclosure && itemsToShow[0].enclosure.url && itemsToShow[0].enclosure.type && itemsToShow[0].enclosure.type.startsWith('image')) {
          embed.setThumbnail(itemsToShow[0].enclosure.url);
      }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(`뉴스레터 처리 중 오류 발생 (URL: ${rssUrl}, 종류: ${selectedCategory}):`, error);
      await interaction.editReply({ content: '뉴스레터를 가져오는 중 오류가 발생했습니다. RSS URL을 확인하거나 잠시 후 다시 시도해주세요.', ephemeral: true });
    }
  },
};