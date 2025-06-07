const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Parser = require('rss-parser');
const parser = new Parser();
const logger = require('../logger'); // 로거가 있다면 사용

// 뉴스레터 피드 목록 (오브젝트-키 형식)
// 키: 사용자에게 보여질 선택지 이름
// 값: 해당 뉴스레터의 RSS 피드 URL
const newsletterFeeds = {
  "헤드라인":"https://www.mk.co.kr/rss/30000001/",
  "스포츠": "https://www.mk.co.kr/rss/71000001/",
  "정치": "https://www.mk.co.kr/rss/30200030/",
  "경제": "https://www.mk.co.kr/rss/30100041/",
  "게임": "https://www.mk.co.kr/rss/50700001/",
  "사회": "https://www.mk.co.kr/rss/50400012/",
  "국제": "https://www.mk.co.kr/rss/30300018/",
  "머니 앤 리치스": "https://www.mk.co.kr/rss/40200003/"
};

// 뉴스 Embed 생성 로직을 별도 함수로 분리
async function fetchNewsEmbed(selectedCategory) {
  const rssUrl = newsletterFeeds[selectedCategory];

  if (!rssUrl) {
    logger.warn(`뉴스레터 (fetchNewsEmbed): 유효하지 않은 종류 - ${selectedCategory}`);
    return null; // 오류 또는 유효하지 않은 카테고리 시 null 반환
  }

  try {
    const feed = await parser.parseURL(rssUrl);

    if (!feed || !feed.items || feed.items.length === 0) {
      logger.warn(`뉴스레터 (fetchNewsEmbed): ${rssUrl} 에서 항목을 찾을 수 없습니다.`);
      return null;
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(feed.title || `${selectedCategory} 뉴스`)
      .setURL(feed.link)
      .setTimestamp(feed.pubDate ? new Date(feed.pubDate) : new Date())
      .setFooter({ text: feed.copyright || `${selectedCategory} 뉴스 - 출처: ${new URL(rssUrl).hostname}` });

    const itemsToShow = feed.items.slice(0, 5);
    itemsToShow.forEach(item => {
      let description = item.contentSnippet || item.content || item.description || '내용 없음';
      if (description.length > 200) {
        description = description.substring(0, 197) + "...";
      }
      description = description.replace(/<[^>]*>?/gm, '');

      embed.addFields({
        name: item.title ? (item.title.length > 250 ? item.title.substring(0, 247) + "..." : item.title) : '제목 없음',
        value: `${description}`
      });
    });

    if (feed.image && feed.image.url) {
      embed.setThumbnail(feed.image.url);
    } else if (itemsToShow.length > 0 && itemsToShow[0].enclosure && itemsToShow[0].enclosure.url && itemsToShow[0].enclosure.type && itemsToShow[0].enclosure.type.startsWith('image')) {
      embed.setThumbnail(itemsToShow[0].enclosure.url);
    }
    return embed;
  } catch (error) {
    logger.error(`뉴스레터 (fetchNewsEmbed) 처리 중 오류 발생 (URL: ${rssUrl}, 종류: ${selectedCategory}):`, error);
    return null; // 오류 발생 시 null 반환
  }
}

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

    // 선택된 카테고리가 newsletterFeeds에 실제로 있는지 한 번 더 확인 (addChoices 덕분에 거의 발생 안 함)
    if (!newsletterFeeds[selectedCategory]) {
        await interaction.reply({ content: '선택한 종류의 뉴스레터 설정을 찾을 수 없습니다.', ephemeral: true });
        logger.warn(`뉴스레터: 유효하지 않은 종류 선택됨 - ${selectedCategory}`);
        return;
    }

    await interaction.deferReply(); // 뉴스레터 가져오는데 시간이 걸릴 수 있으므로 응답을 지연시킵니다.
    const embed = await fetchNewsEmbed(selectedCategory);

    if (embed) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      // fetchNewsEmbed 함수 내부에서 이미 로깅이 이루어짐
      await interaction.editReply({ content: `선택하신 '${selectedCategory}' 뉴스레터에서 새 항목을 찾을 수 없거나, 가져오는 중 문제가 발생했습니다.`, ephemeral: true });
    }
  },
  // 스케줄링된 작업에서 사용할 수 있도록 함수를 내보냅니다.
  fetchNewsEmbed,
};