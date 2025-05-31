const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { create, all } = require('mathjs'); // mathjs import

// mathjs 인스턴스 생성 (필요한 함수만 선택적으로 로드할 수도 있습니다)
const math = create(all);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('계산')
    .setDescription('수식을 계산합니다.')
    .addStringOption(o =>
      o.setName('수식')
       .setDescription('계산할 식 (예: 2 * (3 + 4) / 5^2 - sqrt(9))')
       .setRequired(true)
    ),

  async execute(interaction) {
    const expr = interaction.options.getString('수식');
    try {
      const result = math.evaluate(expr);

      if (typeof result === 'function' || (typeof result === 'object' && result !== null && !Array.isArray(result))) {
        // mathjs가 함수나 복잡한 객체를 반환하는 경우 (예: 'f(x) = x^2' 정의 시도)
        throw new Error('계산 가능한 숫자 결과가 아닙니다. 단순 수식을 입력해주세요.');
      }
      if (result === undefined) {
        throw new Error('수식을 계산할 수 없습니다. 입력값을 확인해주세요.');
      }
      // Infinity, -Infinity, NaN 체크
      if (typeof result === 'number' && !isFinite(result)) {
        throw new Error('계산 결과가 유효한 숫자가 아닙니다 (무한대 또는 NaN).');
      }
      // 배열 결과 처리 (예: 'matrix([1,2],[3,4])') - 여기서는 간단히 문자열로 변환
      const resultString = Array.isArray(result) ? math.format(result, { precision: 14 }) : String(result);


      const successEmbed = new EmbedBuilder()
        .setColor(0xEE82EE) // 보라색 계열
        .setTitle('🔢 계산 결과')
        .addFields(
          { name: '입력한 수식', value: `\`\`\`${expr}\`\`\`` },
          { name: '결과', value: `\`\`\`${resultString}\`\`\`` } // resultString 사용
        )
        .setTimestamp();
      await interaction.reply({ embeds: [successEmbed] });
    } catch (e) {
      // mathjs에서 발생하는 오류 메시지는 비교적 사용자 친화적일 수 있습니다.
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000) // 빨간색
        .setTitle('⚠️ 계산 오류')
        .setDescription(`오류가 발생했습니다: \`${e.message}\`\n입력한 수식을 다시 확인해주세요.`)
        .setTimestamp();
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  },
};
