import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder } from 'discord.js';
import moment from 'moment';

// Helper function to get information about the day, including Nth Sunday if applicable.
// Returns an object: { isSunday: boolean, nth: number (1-5 if Sunday, 0 otherwise), dayName: string }
function getDayInfo(dateMoment) {
  // moment/locale/ko 가 로드되어 한국어 요일 이름이 반환됩니다. (예: "일요일")
  const dayName = dateMoment.format('dddd');

  if (dateMoment.day() !== 0) { // moment().day()에서 0은 일요일입니다.
    return { isSunday: false, nth: 0, dayName: dayName };
  }

  let sundayCount = 0;
  const dayOfMonth = dateMoment.date();
  // 해당 월의 1일부터 주어진 날짜까지 반복하며 일요일 수 계산
  for (let i = 1; i <= dayOfMonth; i++) {
    const tempDate = dateMoment.clone().date(i);
    if (tempDate.day() === 0) {
      sundayCount++;
    }
  }
  return { isSunday: true, nth: sundayCount, dayName: dayName };
}

// Helper function to get the week number of the month.
// Weeks are considered to start on Sunday.
// Returns a number (1-5 or 1-6 depending on the month).
function getWeekOfMonth(dateMoment) {
  const firstDayOfWeekInMonth = dateMoment.clone().startOf('month').day(); // 0 for Sunday, ..., 6 for Saturday
  const dayOfMonth = dateMoment.date();
  return Math.ceil((dayOfMonth + firstDayOfWeekInMonth) / 7);
}

export default {
  data: new SlashCommandBuilder()
    .setName('마트휴무일')
    .setDescription('오늘의 마트 의무휴업일 정보를 확인합니다. (매월 2, 4번째 일요일 기준)'),
  async execute(interaction) {
    const todayMoment = moment(); // coin.js 등에서 moment/locale/ko가 로드되어 있어야 한국어 요일이 정확히 나옵니다.
    const dayInfo = getDayInfo(todayMoment);    const weekOfMonth = getWeekOfMonth(todayMoment); // 해당 월의 주차 계산

    let status = '정상 영업일 가능성이 높습니다.';
    // 날짜, 요일, 주차 정보를 기본 설명으로 설정
    let description = `${todayMoment.format('YYYY-MM-DD')} (${dayInfo.dayName}) — ${weekOfMonth}주차`;

    if (dayInfo.isSunday) {
      // 일요일인 경우, 몇 번째 일요일인지 정보 추가
      description += `, 이 달의 ${dayInfo.nth}번째 일요일`;
      if (dayInfo.nth === 2 || dayInfo.nth === 4) {
        status = '의무휴업일 가능성이 높습니다.';
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('오늘의 마트 의무휴업 정보')
      .addFields({ name: description, value: status })
      .setColor(status.includes('의무휴업') ? 0xFF0000 : 0x00FF00) // 의무휴업일 경우 빨간색, 영업일 경우 초록색
      .setFooter({ text: '참고: 대형마트는 주로 매월 2, 4번째 일요일에 휴무합니다. 지역/지점별로 다를 수 있으니 방문 전 확인하세요.' });

    await interaction.reply({ embeds: [embed] });
  },
};
