const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('계산')
    .setDescription('수식을 계산합니다.')
    .addStringOption(o =>
      o.setName('expression')
       .setDescription('계산할 식')
       .setRequired(true)
    ),

  async execute(interaction) {
    const expr = interaction.options.getString('expression');
    try {
      const result = eval(expr);
      if (result === undefined) throw new Error('올바른 수식을 입력하세요');
      await interaction.reply(`${expr} = ${result}`);
    } catch (e) {
      await interaction.reply({ content: `Error: ${e.message}`, ephemeral: true });
    }
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요