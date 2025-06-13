import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('금액')
    .setDescription('숫자를 한글 금액 표현으로 변환합니다.')
    .addStringOption(o =>
      o.setName('액수')
       .setDescription('숫자만 입력 (쉼표 없이)')
       .setRequired(true)
    ),

  async execute(interaction) {
    const originalAmountStr = interaction.options.getString('액수');
    let numStr = originalAmountStr.replace(/,/g, '');

    if (isNaN(numStr) || numStr.trim() === '') {
      return interaction.reply({ content: '올바른 숫자를 입력해주세요. 숫자만 입력 가능합니다 (쉼표 제외).', flags: MessageFlags.Ephemeral });
    }

    // 매우 큰 숫자에 대한 처리 (예: 16자리 초과, '조' 단위 이상)
    if (numStr.length > 16) {
        return interaction.reply({ content: '너무 큰 숫자입니다. 현재 조 단위까지만 지원합니다.', flags: MessageFlags.Ephemeral });
    }
    if (numStr === '0') {
        const embed = new EmbedBuilder()
            .setColor(0xEE82EE) // 테마 색상 (보라색 계열)
            .setTitle('금액 변환 결과')
            .addFields(
                { name: '입력한 숫자', value: originalAmountStr },
                { name: '변환된 금액', value: '영원' }
            )
        return interaction.reply({ embeds: [embed] });
    }


    const digits = ['', '일','이','삼','사','오','육','칠','팔','구'];
    const places = ['', '십','백','천'];
    const units = ['', '만', '억', '조'];
    let finalKoreanString = '';
    const numLength = numStr.length;
    const numUnitGroups = Math.ceil(numLength / 4);

    for (let unitGroupIdx = 0; unitGroupIdx < numUnitGroups; unitGroupIdx++) {
      const startIndex = Math.max(0, numLength - (unitGroupIdx + 1) * 4);
      const endIndex = numLength - unitGroupIdx * 4;
      const currentChunkStr = numStr.substring(startIndex, endIndex);

      if (parseInt(currentChunkStr, 10) === 0) {
        // If the chunk is "0000", skip it unless it's the only chunk (handled by initial "0" check)
        // or if we need to preserve a unit like in "일억 영만 ...", but standard is to omit "영만".
        continue;
      }

      let koreanForChunk = "";
      for (let j = 0; j < currentChunkStr.length; j++) {
        const digitChar = currentChunkStr[currentChunkStr.length - 1 - j]; // Iterate from right of chunk
        const digitValue = parseInt(digitChar, 10);
        if (digitValue > 0) {
          koreanForChunk = digits[digitValue] + places[j] + koreanForChunk;
        }
      }

      if (koreanForChunk) {
        if (unitGroupIdx > 0) { // Add unit (만, 억, 조) if not the first group from the right
          koreanForChunk += units[unitGroupIdx];
        }
        finalKoreanString = koreanForChunk + finalKoreanString;
      }
    }

    // '일'이 맨 앞에 오고 뒤에 단위가 붙는 경우 '일' 생략 (예: 일십 -> 십, 일백 -> 백)
    for (const p of places) {
        if (p) finalKoreanString = finalKoreanString.replace(new RegExp(`일${p}`, 'g'), p);
    }

    const embed = new EmbedBuilder()
      .setColor(0xEE82EE) // 테마 색상 (보라색 계열)
      .setTitle('금액 변환 결과')
      .addFields(
        { name: '입력한 숫자', value: `\`${originalAmountStr}\`` },
        { name: '변환된 금액', value: `**${finalKoreanString || '영'}원**` }
      )

    await interaction.reply({ embeds: [embed] });
  },
};