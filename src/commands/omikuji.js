const { SlashCommandBuilder } = require('@discordjs/builders');
const _ = require('lodash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('오미쿠지')
    .setDescription('운세를 테스트해볼 수 있습니다.'),

  async execute(interaction) {
    // 운세 종류별 확률 조정을 위한 가중치 배열
    const omikujiPool = [
      ...Array(1).fill('대흉'),  // 1%
      ...Array(1).fill('말흉'),  // 1%
      ...Array(2).fill('반흉'),  // 2%
      ...Array(2).fill('소흉'),  // 2%
      ...Array(3).fill('흉'),    // 3%
      ...Array(15).fill('평'),   // 15%
      ...Array(12).fill('말소길'),// 12%
      ...Array(12).fill('말길'),  // 12%
      ...Array(12).fill('반길'),  // 12%
      ...Array(12).fill('길'),    // 12%
      ...Array(12).fill('소길'),  // 12%
      ...Array(10).fill('중길'), // 10%
      ...Array(6).fill('대길'),  // 6%
    ];
    // _.sample 함수는 배열에서 무작위로 하나의 요소를 선택합니다.
    const result = _.sample(omikujiPool);
    await interaction.reply(`오늘의 운세는... **${result}** 입니다!`);
  },
};
