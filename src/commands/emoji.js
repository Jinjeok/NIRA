import { SlashCommandBuilder } from '@discordjs/builders';

export default {
  data: new SlashCommandBuilder()
    .setName('이모지변환')
    .setDescription('영어를 이모지로 변환')
    .addStringOption(o =>
      o.setName('영문자')
       .setDescription('변환할 영어 문자열')
       .setRequired(true)
    ),

  async execute(interaction) {
    const str = interaction.options.getString('영문자');
    let emojiOutput = '';
    let hasValidChars = false;

    for (const char of str) {
      const lowerChar = char.toLowerCase();
      // 영문 알파벳 a-z 만 regional indicator로 변환
      if (lowerChar >= 'a' && lowerChar <= 'z') {
        emojiOutput += `:regional_indicator_${lowerChar}:`;
        hasValidChars = true;
      }
      // 그 외 문자는 무시
    }

    if (hasValidChars) {
      await interaction.reply(emojiOutput);
    } else {
      await interaction.reply('변환 가능한 영문 알파벳(a-z)이 없습니다. 입력값을 확인해주세요.');
    }
  },
};