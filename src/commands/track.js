import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, MessageFlags } from 'discord.js';
import axios from 'axios';

// 셀프호스트: DELIVERY_TRACKER_URL (기본값 http://localhost:4000/)
// 클라우드:   DELIVERY_TRACKER_URL=https://apis.tracker.delivery/graphql
//             + DELIVERY_TRACKER_CLIENT_ID / DELIVERY_TRACKER_CLIENT_SECRET
const ENDPOINT = process.env.DELIVERY_TRACKER_URL ?? 'http://localhost:4000/';

const CARRIERS = [
  { name: 'CJ대한통운',        value: 'kr.cjlogistics' },
  { name: '한진택배',           value: 'kr.hanjin' },
  { name: '롯데택배',           value: 'kr.lotte' },
  { name: '우체국 국내',       value: 'kr.epost' },
  { name: '우체국 EMS (발송)', value: 'kr.epost.ems' },
  { name: '국제 EMS (수취)',   value: 'un.upu.ems' },
  { name: '쿠팡',              value: 'kr.coupangls' },
  { name: 'CU편의점택배',      value: 'kr.cupost' },
  { name: 'GS Postbox',        value: 'kr.cvsnet' },
  { name: '로젠택배',          value: 'kr.logen' },
  { name: '대신택배',          value: 'kr.daesin' },
  { name: '경동택배',          value: 'kr.kdexp' },
  { name: '천일택배',          value: 'kr.chunilps' },
  { name: 'LX Pantos',         value: 'kr.epantos' },
  { name: 'CWAY(우리택배)',    value: 'kr.cway' },
  { name: 'SLX',               value: 'kr.slx' },
  { name: 'DHL',               value: 'de.dhl' },
  { name: 'FedEx',             value: 'us.fedex' },
  { name: 'UPS',               value: 'us.ups' },
  { name: 'USPS',              value: 'us.usps' },
  { name: 'Yamato (일본)',     value: 'jp.yamato' },
  { name: 'Sagawa (일본)',     value: 'jp.sagawa' },
];

// 운송장 번호에서 국가코드 추출해 자동 감지
function autoDetectCarrier(tracking) {
  // EMS 형식: 영문2 + 숫자8~9 + 영문2 (예: EL574714325JP, EE123456789KR)
  const emsMatch = tracking.match(/^[A-Z]{2}\d{8,9}([A-Z]{2})$/);
  if (emsMatch) {
    const country = emsMatch[1];
    if (country === 'KR') return 'kr.epost.ems';
    return 'un.upu.ems'; // JP, CN 등 해외발
  }
  return null;
}

const STATUS_LABELS = {
  INFORMATION_RECEIVED: '운송장 등록',
  AT_PICKUP:            '집화 처리',
  IN_TRANSIT:           '배송중',
  OUT_FOR_DELIVERY:     '배달 출발',
  ATTEMPT_FAIL:         '배달 실패',
  DELIVERED:            '배달 완료',
  AVAILABLE_FOR_PICKUP: '보관중',
  EXCEPTION:            '예외 상황',
  UNKNOWN:              '알 수 없음',
};

const STATUS_COLORS = {
  DELIVERED:            0x57F287,
  OUT_FOR_DELIVERY:     0x5865F2,
  IN_TRANSIT:           0x3498DB,
  AT_PICKUP:            0xFEE75C,
  ATTEMPT_FAIL:         0xED4245,
  EXCEPTION:            0xED4245,
  AVAILABLE_FOR_PICKUP: 0xEB459E,
  INFORMATION_RECEIVED: 0xAAAAAA,
  UNKNOWN:              0xAAAAAA,
};

const TRACK_QUERY = `
  query Track($carrierId: ID!, $trackingNumber: String!) {
    track(carrierId: $carrierId, trackingNumber: $trackingNumber) {
      lastEvent {
        time
        status { code }
        location { name }
        description
      }
      events(last: 10) {
        edges {
          node {
            time
            status { code }
            location { name }
            description
          }
        }
      }
    }
  }
`;

export default {
  data: new SlashCommandBuilder()
    .setName('배송조회')
    .setDescription('운송장 번호로 배송 상태를 조회합니다. (CJ, 한진, 롯데, 우체국 등)')
    .addStringOption(opt =>
      opt.setName('운송장')
        .setDescription('운송장 번호')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('택배사')
        .setDescription('택배사 선택 (EMS는 자동 감지, 나머지는 필수)')
        .setRequired(false)
        .addChoices(...CARRIERS)
    ),

  async execute(interaction) {
    const tracking = interaction.options.getString('운송장').trim().toUpperCase();

    const carrierId = interaction.options.getString('택배사') ?? autoDetectCarrier(tracking);
    if (!carrierId) {
      return interaction.reply({
        content: '택배사를 선택해주세요. EMS 국제우편이 아닌 경우 자동 감지가 불가합니다.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    try {
      const headers = { 'Content-Type': 'application/json' };

      // 클라우드 모드일 때만 인증 헤더 추가
      const clientId     = process.env.DELIVERY_TRACKER_CLIENT_ID;
      const clientSecret = process.env.DELIVERY_TRACKER_CLIENT_SECRET;
      if (clientId && clientSecret) {
        headers['Authorization'] = `TRACKQL-API-KEY ${clientId}:${clientSecret}`;
      }

      const res = await axios.post(
        ENDPOINT,
        { query: TRACK_QUERY, variables: { carrierId, trackingNumber: tracking } },
        { headers, timeout: 15000 }
      );

      if (res.data?.errors?.length) {
        const msg = res.data.errors[0].message;
        return interaction.editReply({ content: `API 오류: ${msg}` });
      }

      const data = res.data?.data?.track;
      if (!data || !data.lastEvent) {
        return interaction.editReply({
          content: `\`${tracking}\`에 대한 배송 정보를 찾을 수 없습니다. 운송장 번호와 택배사를 확인해주세요.`,
        });
      }

      const last = data.lastEvent;
      const statusCode  = last.status?.code ?? 'UNKNOWN';
      const statusLabel = STATUS_LABELS[statusCode] ?? statusCode;
      const color = STATUS_COLORS[statusCode] ?? 0xEE82EE;
      const carrierName = CARRIERS.find(c => c.value === carrierId)?.name ?? carrierId;

      const events = (data.events?.edges ?? []).map(e => e.node);
      const historyText = events.length
        ? events.map(e => {
            const time = e.time
              ? new Date(e.time).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
              : '-';
            const label = STATUS_LABELS[e.status?.code] ?? e.status?.code ?? '-';
            const loc  = e.location?.name ?? '';
            const desc = e.description ?? '';
            return `\`${time}\` **${label}**${loc ? ` — ${loc}` : ''}${desc && desc !== loc ? `\n↳ ${desc}` : ''}`;
          }).join('\n')
        : '-';

      const lastTime = last.time
        ? new Date(last.time).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
        : '-';

      const embed = new EmbedBuilder()
        .setTitle(`${carrierName} 배송 조회`)
        .setDescription(`운송장 번호: \`${tracking}\``)
        .addFields(
          { name: '현재 상태', value: `**${statusLabel}**`, inline: true },
          { name: '최종 위치', value: last.location?.name || '-', inline: true },
          { name: '최종 일시', value: lastTime, inline: true },
          { name: `배송 이력 (최근 ${events.length}건)`, value: historyText },
        )
        .setColor(color)
        .setFooter({ text: 'Powered by delivery-tracker', iconURL: interaction.client.user.displayAvatarURL() })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message
        ?? (err.response ? `HTTP ${err.response.status}` : err.message);
      await interaction.editReply({ content: `조회 중 오류가 발생했습니다: ${msg}` });
    }
  },
};
