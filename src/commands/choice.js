// src/commands/선택.js
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('선택')
        .setDescription('여러 항목 중 하나를 랜덤으로 선택해줍니다.')
        .addStringOption(option =>
            option.setName('항목들')
                .setDescription('선택할 항목들을 쉼표(,)로 구분하여 입력해주세요. (예: 밥, 국수, 빵)')
                .setRequired(true)
        ),
    async execute(interaction, client, logger) {
        const itemsString = interaction.options.getString('항목들');
        const items = itemsString.split(',').map(item => item.trim()).filter(item => item !== '');

        if (items.length === 0) {
            await interaction.reply({ content: '선택할 항목이 없습니다. 쉼표로 구분하여 입력해주세요.', flags: MessageFlags.Ephemeral });
            logger.warn(`사용자가 '/선택' 명령어로 항목 없이 호출했습니다. 입력: "${itemsString}"`);
            return;
        }

        const selectedItem = items[Math.floor(Math.random() * items.length)];

        const resultEmbed = new EmbedBuilder()
            .setColor(0xEE82EE) // 보라색 계열
            .setTitle('선택 결과')
            .setDescription(`**항목:** \n${items.map((item, index) => `- ${item}`).join('\n')}\n\n**선택된 항목:** \n**${selectedItem}**`)
            .setFooter({ text: '동일한 확률로 공정하게 선택되었습니다.' });



        await interaction.reply({ embeds: [resultEmbed] });

    },
};