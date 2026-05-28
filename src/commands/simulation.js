import { SlashCommandBuilder } from '@discordjs/builders';
import _ from 'lodash';
import { EmbedBuilder, MessageFlags } from '../discord.js';

/**
 * 숫자의 실제 소수점 이하 자릿수를 계산합니다. 지수 표기법을 고려합니다.
 * @param {number} num - 자릿수를 계산할 숫자입니다.
 * @returns {number} 소수점 이하 자릿수입니다.
 */
function countDecimalPlaces(num) {
    const numStr = String(num);
    if (numStr.includes('e')) {
        const parts = numStr.split('e');
        const mantissa = parts[0];
        const exponent = parseInt(parts[1], 10);
        let decimalPlacesInMantissa = 0;
        if (mantissa.includes('.')) {
            decimalPlacesInMantissa = mantissa.split('.')[1].length;
        }
        return Math.max(0, decimalPlacesInMantissa - exponent);
    } else if (numStr.includes('.')) {
        return numStr.split('.')[1].length;
    }
    return 0;
}

export default {
  data: new SlashCommandBuilder()
    .setName('확률')
    .setDescription('입력된 확률이 몇번만에 성공하는지 확인합니다.')
    .addNumberOption(o =>
      o.setName('확률')
       .setDescription('% 확률')
       .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('횟수')
       .setDescription('고정 시도 횟수 (입력 시 해당 횟수만큼 시도, 없으면 첫 성공까지 시도)')
       .setRequired(false)
       .setMinValue(1) // 최소 시도 횟수는 1
       .setMaxValue(1_000_000) // 최대 시도 횟수 (예: 100만번)
    ),

  async execute(interaction) {
    const p = interaction.options.getNumber('확률');
    const numberOfTries = interaction.options.getInteger('횟수');

    if (p < 0 || p > 100) {
      return interaction.reply({ content: '확률은 0에서 100 사이의 값이어야 합니다.', flags: MessageFlags.Ephemeral });
    }

    if (countDecimalPlaces(p) > 7) {
      return interaction.reply({ content: '확률의 소수점은 7자리까지만 입력 가능합니다. (예: 0.1234567)', flags: MessageFlags.Ephemeral });
    }

    const randomMax = 1_000_000_000; // 10억
    const successThreshold = p * 10_000_000; // p%를 10억 기준으로 변환 (p * 10^7)

    if (numberOfTries !== null && numberOfTries !== undefined) {
      // --- 고정 시도 횟수 모드 ---
      // 옵션에서 minValue, maxValue를 설정했으므로, 여기서는 추가적인 범위 검사가 필요 없을 수 있습니다.
      // 하지만 SlashCommandBuilder의 제약이 클라이언트 측에서만 동작할 수 있으므로 서버 측 검증도 유지하는 것이 안전합니다.
      if (numberOfTries <= 0 || numberOfTries > 1_000_000) {
        return interaction.reply({ content: '시도 횟수는 1에서 1,000,000 사이여야 합니다.', flags: MessageFlags.Ephemeral });
      }

      let successCount = 0;
      for (let i = 0; i < numberOfTries; i++) {
        if (_.random(1, randomMax) <= successThreshold) {
          successCount++;
        }
      }

      const actualSuccessRate = numberOfTries > 0 ? (successCount / numberOfTries * 100).toFixed(2) : "0.00";

      const fixedTriesEmbed = new EmbedBuilder()
        .setColor(0xEE82EE)
        .setTitle('🎲 고정 횟수 시뮬레이션 결과')
        .addFields(
          { name: '입력 확률', value: `${p}%`, inline: true },
          { name: '시도 횟수', value: `${numberOfTries.toLocaleString()}회`, inline: true },
          { name: '성공 횟수', value: `${successCount.toLocaleString()}회`, inline: true },
          { name: '실제 성공률', value: `${actualSuccessRate}%`, inline: true }
        );
      await interaction.reply({ embeds: [fixedTriesEmbed] });

    } else {
      // --- 첫 성공까지 시도 모드 (기존 로직) ---
      const maxAttempts = 5_000_000;
      for (let i = 1; i <= maxAttempts; i++) { // 최대 500만번 시도
        if (_.random(1, randomMax) <= successThreshold) {
          const successEmbed = new EmbedBuilder()
            .setColor(0xEE82EE)
            .setTitle('🎲 확률 시뮬레이션 성공!')
            .setDescription(`입력된 확률 **${p}%** 로 시뮬레이션을 진행한 결과,\n시도 횟수 **${i.toLocaleString()}번** 만에 성공했습니다.`)
            .setTimestamp()
            .setFooter({ text: `요청자: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });
          return interaction.reply({ embeds: [successEmbed] });
        }
      }

      const failEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🎲 확률 시뮬레이션 실패')
        .setDescription(`입력된 확률 **${p}%** 로 시뮬레이션을 진행했지만,`)
        .addFields(
          { name: '결과', value: `최대 **${maxAttempts.toLocaleString()}번** 시도했으나 성공하지 못했습니다.` }
        );
      await interaction.reply({ embeds: [failEmbed] });
    }
  },
};