const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('말')
    .setDescription('메시지를 NIRA가 대신 보냅니다.')
    .addStringOption(o =>
      o.setName('메시지')
       .setDescription('보낼 메시지')
       .setRequired(true)
    ),

  async execute(interaction) {
    const content = interaction.options.getString('메시지');
    await interaction.reply({ content, ephemeral: false });
  },
};

