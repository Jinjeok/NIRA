// d:\Users\KHM\OneDrive\Documents\dev\NIRA\src\commands\gemini.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const logger = require('../logger'); // 프로젝트에 로거가 있다면 사용하세요.

// .env 파일에서 API 키를 로드합니다.
const apiKey = process.env.GEMINI_API_KEY;
let genAI;
if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
}

const model = genAI ? genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite", // 또는 "gemini-pro" 등 사용 가능한 모델
    generationConfig: {
        maxOutputTokens: 256, // 답변의 최대 토큰 수를 256으로 제한 (자원 절약)
    },
    // 안전 설정을 조정할 수 있습니다. 필요에 따라 주석을 해제하거나 값을 변경하세요.
    // safetySettings: [
    //   {
    //     category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    //     threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    //   },
    // ],
}) : null;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('제미나이')
        .setDescription('Gemini AI에게 질문합니다.')
        .addStringOption(option =>
            option.setName('프롬프트')
                .setDescription('Gemini에게 전달할 프롬프트')
                .setRequired(true)),
    async execute(interaction) {
        const prompt = interaction.options.getString('프롬프트');

        if (!apiKey || !genAI || !model) {
            logger.error('Gemini API 키가 설정되지 않았거나 초기화에 실패했습니다.');
            return interaction.reply({ content: 'Gemini API 설정에 문제가 있어 명령을 실행할 수 없습니다. 관리자에게 문의하세요.', ephemeral: true });
        }

        let genAIResponse; // try 블록 외부에서 선언하여 catch 블록에서도 접근 가능하도록 함

        try {
            await interaction.deferReply(); // Gemini 응답은 시간이 걸릴 수 있습니다.

            const result = await model.generateContent(prompt);
            genAIResponse = result.response; // genAIResponse에 할당
            const text = genAIResponse.text();

            if (text) {
                // Discord 메시지 길이 제한 (2000자) 및 Embed 설명 길이 제한 (4096자) 고려
                const embed = new EmbedBuilder()
                    .setColor(0x4285F4) // Google Blue
                    .setTitle('Gemini AI 처리 결과') // 제목을 좀 더 일반적인 것으로 변경
                    .setDescription(prompt.length > 240 ? prompt.substring(0, 237) + "..." : prompt) // 프롬프트를 설명(description)으로 이동, 240자 제한
                    .addFields({ name: 'Gemini AI의 답변', value: text.length > 1024 ? text.substring(0, 1021) + "..." : text }) // 답변을 필드로 이동 (최대 1024자)
                    .setFooter({ text: 'Powered by Google Gemini 2.0 Flash Lite' })
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.editReply({ content: 'Gemini로부터 유효한 응답을 받지 못했습니다. 프롬프트나 API 상태를 확인해주세요.' });
            }

        } catch (error) {
            logger.error(`Gemini 명령어 실행 중 오류 발생: ${error.message}`, error);
            let replyMessage = 'Gemini와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
            if (error.message.includes('API key not valid')) {
                replyMessage = 'Gemini API 키가 유효하지 않습니다. 관리자에게 문의하세요.';
            } else if (genAIResponse && genAIResponse.promptFeedback && genAIResponse.promptFeedback.blockReason) { // SAFETY 관련 블록 확인
                replyMessage = `Gemini가 안전상의 이유로 응답을 생성할 수 없습니다 (이유: ${genAIResponse.promptFeedback.blockReason}). 다른 프롬프트를 시도해주세요.`;
            }
            await interaction.editReply({ content: replyMessage, ephemeral: true });
        }
    },
};