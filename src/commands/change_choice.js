// src/commands/확률선택.js
import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import logger from '../logger.js'; // logger 모듈을 가져옵니다.

export default {
    data: new SlashCommandBuilder()
        .setName('확률선택')
        .setDescription('항목별 확률에 따라 하나를 선택해줍니다.')
        .addStringOption(option =>
            option.setName('항목들')
                .setDescription('선택할 항목들을 쉼표(,)로 구분하여 입력해주세요. (예: 밥, 국수, 빵)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('확률들')
                .setDescription('각 항목의 확률을 쉼표(,)로 구분하여 입력해주세요. (예: 50,30,20)')
                .setRequired(true)
        ),
    async execute(interaction) {
        const itemsString = interaction.options.getString('항목들');
        const probabilitiesString = interaction.options.getString('확률들');

        const items = itemsString.split(',').map(item => item.trim()).filter(item => item !== '');
        const probabilities = probabilitiesString.split(',').map(p => Number(p.trim())).filter(p => !isNaN(p));

        // 1. 항목과 확률의 개수가 일치하는지 확인
        if (items.length === 0 || probabilities.length === 0) {
            await interaction.reply({ content: '선택할 항목이나 확률이 없습니다. 올바르게 입력해주세요.', flags: MessageFlags.Ephemeral });
            logger.warn(`사용자가 확률선택 명령어를 항목/확률 없이 호출했습니다. 항목: "${itemsString}", 확률: "${probabilitiesString}"`);
            return;
        }

        if (items.length !== probabilities.length) {
            await interaction.reply({ content: '항목의 개수와 확률의 개수가 일치하지 않습니다. 다시 확인해주세요.', flags: MessageFlags.Ephemeral });
            logger.warn(`확률선택 - 항목/확률 개수 불일치. 항목 수: ${items.length}, 확률 수: ${probabilities.length}`);
            return;
        }

        // 2. 확률의 합이 100인지 확인
        const totalProbability = probabilities.reduce((sum, current) => sum + current, 0);
        if (totalProbability !== 100) {
            await interaction.reply({ content: `확률의 총합이 100이 아닙니다. 현재 총합: ${totalProbability}. 다시 확인해주세요.`, flags: MessageFlags.Ephemeral });
            logger.warn(`확률선택 - 확률 총합 불일치. 총합: ${totalProbability}`);
            return;
        }

        // 3. 확률에 따라 항목 선택 로직 구현
        let selectedItem = '선택 실패'; // 기본값
        const randomNum = Math.random() * 100; // 0 이상 100 미만의 실수
        let cumulativeProbability = 0;

        for (let i = 0; i < items.length; i++) {
            cumulativeProbability += probabilities[i];
            if (randomNum < cumulativeProbability) {
                selectedItem = items[i];
                break;
            }
        }

        const resultEmbed = new EmbedBuilder()
            .setColor(0xEE82EE) // 보라색 계열
            .setTitle('확률 선택 결과')
            .setDescription(`**항목:** \n${items.map((item, index) => `- ${item} (${probabilities[index]}%)`).join('\n')}\n\n**선택된 항목:** \n**${selectedItem}**`)
            .setFooter({ text: '확률에 따라 공정하게 선택되었습니다.' });

        await interaction.reply({ embeds: [resultEmbed] });
    },
};
