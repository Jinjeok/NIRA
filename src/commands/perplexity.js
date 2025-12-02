import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import logger from '../logger.js';
import { checkLimit, incrementUsage, getLimits } from '../utils/usageManager.js';

export default {
    data: new SlashCommandBuilder()
        .setName('perplexity')
        .setDescription('Perplexity AI에게 질문하거나 사용량을 확인합니다.')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Perplexity에게 물어볼 질문 (비워두면 사용량 확인)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('model')
                .setDescription('사용할 모델 (기본: sonar)')
                .setRequired(false)
                .addChoices(
                    { name: 'Sonar Pro (일반, 하루 3회)', value: 'sonar-pro' },
                    { name: 'Sonar Reasoning (추론, 하루 5회)', value: 'sonar-reasoning' },
                    { name: 'Sonar (경량, 하루 15회)', value: 'sonar' }
                )),
    async execute(interaction) {
        await interaction.deferReply();

        const prompt = interaction.options.getString('prompt');
        const model = interaction.options.getString('model') || 'sonar';
        const apiKey = process.env.PERPLEXITY_API_KEY;

        // Status Check Mode (No prompt provided)
        if (!prompt) {
            const limits = getLimits();
            const embed = new EmbedBuilder()
                .setColor(0x20B2AA)
                .setTitle('📊 Perplexity 일일 사용량 확인')
                .setDescription('오늘 사용한 횟수와 남은 횟수입니다. (매일 자정 초기화)')
                .setTimestamp();

            for (const [modelKey, limit] of Object.entries(limits)) {
                const status = await checkLimit(modelKey);
                // Calculate percentage for progress bar (optional, but nice)
                const used = status.current;
                const remaining = status.remaining;
                const percentage = Math.min(100, Math.round((used / limit) * 100));
                const barLength = 10;
                const filledLength = Math.round((percentage / 100) * barLength);
                const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

                let modelName = modelKey;
                if (modelKey === 'sonar-pro') modelName = 'Sonar Pro (일반)';
                else if (modelKey === 'sonar-reasoning') modelName = 'Sonar Reasoning (추론)';
                else if (modelKey === 'sonar') modelName = 'Sonar (경량)';

                embed.addFields({
                    name: `${modelName}`,
                    value: `\`${bar}\` ${percentage}%\n사용: **${used}** / 한도: **${limit}** (남음: ${remaining})`,
                    inline: false
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        if (!apiKey) {
            return interaction.editReply({ content: 'Perplexity API 키가 설정되지 않았습니다. 관리자에게 문의하세요.' });
        }

        // Check usage limit
        const limitStatus = await checkLimit(model);
        if (!limitStatus.allowed) {
            return interaction.editReply({ 
                content: `🚫 **일일 사용량 초과**\n'${model}' 모델의 하루 사용 한도(${limitStatus.limit}회)를 모두 사용했습니다.\n내일 다시 시도하거나 다른 모델을 사용해주세요.` 
            });
        }

        // Set max_tokens based on model
        let maxTokens = 4096; // Default for sonar-pro
        if (model === 'sonar-reasoning') {
            maxTokens = 8192;
        } else if (model === 'sonar') {
            maxTokens = 2048;
        }

        try {
            logger.info(`[Perplexity] Requesting ${model} with prompt: ${prompt} (max_tokens: ${maxTokens})`);

            const response = await fetch('https://api.perplexity.ai/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: 'You are a helpful AI assistant. Answer in Korean unless requested otherwise.' },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: maxTokens
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            const answer = data.choices[0].message.content;
            const citations = data.citations || [];

            // Increment usage after successful response
            await incrementUsage(model);
            const updatedLimit = await checkLimit(model);

            const embed = new EmbedBuilder()
                .setColor(0x20B2AA) // Light Sea Green
                .setTitle('Perplexity AI 검색 결과')
                .setDescription(answer.length > 4096 ? answer.substring(0, 4093) + "..." : answer)
                .setFooter({ text: `Model: ${model} • 남은 횟수: ${updatedLimit.remaining}/${updatedLimit.limit} • Powered by Perplexity` })
                .setTimestamp();

            if (citations.length > 0) {
                const citationText = citations.map((c, i) => `[${i + 1}] ${c}`).join('\n');
                // Discord field value limit is 1024 characters
                if (citationText.length < 1024) {
                    embed.addFields({ name: '참조 (Citations)', value: citationText });
                } else {
                    embed.addFields({ name: '참조 (Citations)', value: citationText.substring(0, 1020) + '...' });
                }
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error(`[Perplexity] Error: ${error.message}`, error);
            await interaction.editReply({ content: `오류가 발생했습니다: ${error.message}` });
        }
    }
};
