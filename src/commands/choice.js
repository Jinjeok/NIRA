// src/commands/선택.js
import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import logger from '../logger.js'; // logger 모듈을 가져옵니다.

export default {
    data: new SlashCommandBuilder()
        .setName('선택')
        .setDescription('여러 항목 중 하나를 랜덤으로 선택하거나, 확률에 따라 선택해줍니다.') // Updated description
        .addStringOption(option =>
            option.setName('항목')
                .setDescription('선택할 항목들을 쉼표(,)로 구분하여 입력해주세요. (예: 밥, 국수, 빵)')
                .setRequired(true)
        )
        .addStringOption(option => // New option for probabilities
            option.setName('확률')
                .setDescription('각 항목의 확률을 쉼표(,)로 구분하여 입력해주세요. (예: 50,30,20). 항목 개수와 일치해야 합니다.')
                .setRequired(false) // Make it optional
        ),
    async execute(interaction, client, logger) {
        const itemsString = interaction.options.getString('항목');
        const probabilitiesString = interaction.options.getString('확률');

        const items = itemsString.split(',').map(item => item.trim()).filter(item => item !== '');

        let selectedItem;
        let embedDescription;
        let footerText;

        if (probabilitiesString) {
            // Probability-based selection
            const probabilities = probabilitiesString.split(',').map(p => Number(p.trim())).filter(p => !isNaN(p));

            // Validation 1: Check if items or probabilities are empty after parsing
            if (items.length === 0 || probabilities.length === 0) {
                await interaction.reply({ content: '선택할 항목이나 확률이 없습니다. 올바르게 입력해주세요.', flags: MessageFlags.Ephemeral });
                logger.warn(`사용자가 확률선택 명령어를 항목/확률 없이 호출했습니다. 항목: "${itemsString}", 확률: "${probabilitiesString}"`);
                return;
            }

            // Validation 2: Check if number of items matches number of probabilities
            if (items.length !== probabilities.length) {
                await interaction.reply({ content: '항목의 개수와 확률의 개수가 일치하지 않습니다. 다시 확인해주세요.', flags: MessageFlags.Ephemeral });
                logger.warn(`확률선택 - 항목/확률 개수 불일치. 항목 수: ${items.length}, 확률 수: ${probabilities.length}`);
                return;
            }

            // Validation 3: Check if total probability is 100
            const totalProbability = probabilities.reduce((sum, current) => sum + current, 0);
            if (totalProbability !== 100) {
                await interaction.reply({ content: `확률의 총합이 100이 아닙니다. 현재 총합: ${totalProbability}. 다시 확인해주세요.`, flags: MessageFlags.Ephemeral });
                logger.warn(`확률선택 - 확률 총합 불일치. 총합: ${totalProbability}`);
                return;
            }

            // Perform probabilistic selection
            const randomNum = Math.random() * 100; // 0 이상 100 미만의 실수
            let cumulativeProbability = 0;

            for (let i = 0; i < items.length; i++) {
                cumulativeProbability += probabilities[i];
                if (randomNum < cumulativeProbability) {
                    selectedItem = items[i];
                    break;
                }
            }
            // Fallback if somehow no item is selected (shouldn't happen with totalProbability === 100)
            if (!selectedItem) {
                selectedItem = items[items.length - 1]; // Default to last item if something goes wrong
            }

            embedDescription = `**항목:** \n${items.map((item, index) => `- ${item} (${probabilities[index]}%)`).join('\n')}\n\n**선택된 항목:** \n**${selectedItem}**`;
            footerText = '확률에 따라 공정하게 선택되었습니다.';

        } else {
            // Standard random selection (original choice.js logic)
            if (items.length === 0) {
                await interaction.reply({ content: '선택할 항목이 없습니다. 쉼표로 구분하여 입력해주세요.', flags: MessageFlags.Ephemeral });
                logger.warn(`사용자가 '/선택' 명령어로 항목 없이 호출했습니다. 입력: "${itemsString}"`);
                return;
            }

            selectedItem = items[Math.floor(Math.random() * items.length)];
            embedDescription = `**항목:** \n${items.map((item, index) => `- ${item}`).join('\n')}\n\n**선택된 항목:** \n**${selectedItem}**`;
            footerText = '동일한 확률로 공정하게 선택되었습니다.';
        }

        const resultEmbed = new EmbedBuilder()
            .setColor(0xEE82EE) // 보라색 계열
            .setTitle('선택 결과')
            .setDescription(embedDescription)
            .setFooter({ text: footerText });

        await interaction.reply({ embeds: [resultEmbed] });
    },
};