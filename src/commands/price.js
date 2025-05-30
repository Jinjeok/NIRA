const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('금액')
    .setDescription('숫자를 한글 금액 표현으로 변환')
    .addStringOption(o =>
      o.setName('amount')
       .setDescription('숫자만 입력 (쉼표 없이)')
       .setRequired(true)
    ),

  async execute(interaction) {
    let numStr = interaction.options.getString('amount').replace(/,/g, '');
    if (isNaN(numStr)) {
      return interaction.reply('올바른 숫자를 입력하세요.');
    }

    const digits = ['', '일','이','삼','사','오','육','칠','팔','구'];
    const places = ['', '십','백','천'];
    let result = '';

    for (let i = 0; i < numStr.length; i++) {
      const n = digits[numStr[numStr.length - 1 - i]];
      if (n) {
        result = n + places[i % 4] + (i === 4 ? '만' : i === 8 ? '억' : i === 12 ? '조' : '') + result;
      }
    }

    await interaction.reply(result + '원');
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요