import { SlashCommandBuilder } from '@discordjs/builders';
import moment from 'moment';
import { EmbedBuilder } from '../discord.js';
import 'moment/locale/ko.js';

export default {
  data: new SlashCommandBuilder()
    .setName('디데이')
    .setDescription('오늘과의 일수 차이 계산')
    .addStringOption(o =>
      o.setName('날짜')
       .setDescription('YYMMDD, YYYYMMDD, 또는 MMDD (MMDD 입력 시 올해 기준)')
       .setRequired(true)
    ),

  async execute(interaction) {
    // 한국어 요일 표시를 위해 로케일 설정 (다른 파일에서 이미 설정되었을 수 있지만, 명시적으로 추가)

    const s = interaction.options.getString('날짜');
    let dtMoment = moment(s, 'YYMMDD', true); // YYMMDD 형식으로 파싱 (엄격 모드)
    if (!dtMoment.isValid()) {
      dtMoment = moment(s, 'YYYYMMDD', true); // YYYYMMDD 형식으로 파싱 (엄격 모드)
      if (!dtMoment.isValid()) {
        // MMDD 형식 시도
        dtMoment = moment(s, 'MMDD', true);
        if (dtMoment.isValid()) {
          dtMoment.year(moment().year()); // 올해 연도로 설정
        }
      }
    }
    if (!dtMoment.isValid()) {
      return interaction.reply({ content: '올바른 날짜 포맷이 아닙니다! (YYMMDD, YYYYMMDD, 또는 MMDD)', ephemeral: true });
    }

    const targetDate = dtMoment.clone().startOf('day'); // 비교를 위해 시간 부분 초기화
    const today = moment().startOf('day'); // 오늘 날짜의 시작 시간

    // targetDate.diff(today, 'days')는 (목표 날짜 - 오늘 날짜)의 일수를 반환합니다.
    // 예: 목표가 내일이면 1, 어제면 -1, 오늘이면 0.
    const diffDays = targetDate.diff(today, 'days');

    let dDayString;
    let embedColor = 0xEE82EE; // 기본 보라색

    if (diffDays === 0) {
      dDayString = "D-DAY";
      embedColor = 0xA9A9A9; // DarkGray (어두운 회색)
    } else if (diffDays > 0) {
      // 목표 날짜가 미래인 경우 (예: diffDays = 1 이면 내일)
      dDayString = `D-${diffDays}`;
      embedColor = 0xF08080; // LightCoral (연한 산호색)
    } else {
      // 목표 날짜가 과거인 경우 (예: diffDays = -1 이면 어제)
      dDayString = `D+${Math.abs(diffDays)}`;
      embedColor = 0x6495ED; // CornflowerBlue (수레국화색)
    }

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('🗓️ D-Day 계산 결과')
        .addFields(
            { name: '기준일', value: dtMoment.format('YYYY년 MM월 DD일 (dddd)') },
            { name: '결과', value: `**${dDayString}**` }
        )

    await interaction.reply({ embeds: [embed] });
  },
};
