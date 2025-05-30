const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('찬반')
    .setDescription('찬성/반대 시뮬레이션')
    .addIntegerOption(o =>
      o.setName('times')
       .setDescription('횟수')
       .setRequired(true)
    ),

  async execute(interaction) {
    const n = interaction.options.getInteger('times');
    let yes = 0, no = 0;
    for (let i = 0; i < n; i++) {
      if (Math.random() < 0.5) yes++;
      else no++;
    }
    await interaction.reply(
      `찬성: ${yes}\n반대: ${no}\n찬성률: ${(yes / n * 100).toFixed(2)}%`
    );
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요