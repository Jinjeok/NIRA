import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenAI, Modality } from "@google/genai";
import logger from '../logger.js';
import { fileURLToPath } from 'node:url';
import { loadSession, saveSession, deleteSession } from '../utils/sessionManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default {
    data: new SlashCommandBuilder()
        .setName('제미나이')
        .setDescription('Gemini AI에게 질문합니다.')
        .addStringOption(option =>
            option.setName('프롬프트')
                .setDescription('Gemini에게 전달할 프롬프트')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('이미지생성')
                .setDescription('Gemini에게 이미지 생성을 요청합니다 (true/false).')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('세션')
                .setDescription('대화 세션을 유지합니다 (true/false, 기본: false)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('세션초기화')
                .setDescription('대화 세션을 초기화합니다 (true/false)')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();
        
        const prompt = interaction.options.getString('프롬프트');
        const imageCreation = interaction.options.getBoolean('이미지생성') ?? false;
        const useSession = interaction.options.getBoolean('세션') ?? false;
        const resetSession = interaction.options.getBoolean('세션초기화') ?? false;
        const userId = interaction.user.id;

        // 세션 초기화 요청 처리
        if (resetSession) {
            const deleted = await deleteSession(userId);
            if (deleted) {
                await interaction.editReply({ content: '세션이 초기화되었습니다.', ephemeral: true });
            } else {
                await interaction.editReply({ content: '초기화할 세션이 없습니다.', ephemeral: true });
            }
            return;
        }

        if (!imageCreation) {
            try {
                let history = [];
                
                // 세션 사용 시 기존 히스토리 로드
                if (useSession) {
                    const session = await loadSession(userId);
                    if (session && session.history) {
                        history = session.history;
                        logger.info(`[GeminiCommand] Loaded session for user ${userId} with ${history.length} messages`);
                    }
                }

                // 현재 프롬프트를 히스토리에 추가
                history.push({
                    role: 'user',
                    parts: [{ text: prompt }]
                });

                // Gemini API 호출
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-lite',
                    contents: history,
                });

                const responseText = response.text;
                
                // 응답을 히스토리에 추가
                history.push({
                    role: 'model',
                    parts: [{ text: responseText }]
                });

                // 세션 사용 시 히스토리 저장
                if (useSession) {
                    await saveSession(userId, history);
                    logger.info(`[GeminiCommand] Saved session for user ${userId}`);
                }
                
                const embed = new EmbedBuilder()
                    .setColor(0x4285F4)
                    .setTitle('Gemini AI 처리 결과')
                    .setDescription(prompt.length > 240 ? prompt.substring(0, 237) + "..." : prompt)
                    .addFields({ 
                        name: 'Gemini AI의 답변', 
                        value: responseText && typeof responseText === 'string' ? 
                            (responseText.length > 1024 ? responseText.substring(0, 1021) + "..." : responseText) : 
                            "응답을 받지 못했습니다." 
                    })
                    .setFooter({ text: useSession ? 'Powered by Google Gemini (세션 모드)' : 'Powered by Google Gemini' })
                    .setTimestamp();
                    
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                logger.error(`Gemini API 처리 중 오류: ${error.message}`, error);
                await interaction.editReply({ content: 'Gemini AI 처리 중 오류가 발생했습니다. 모델 설정이나 API 키를 확인해주세요.', ephemeral: true });
            }
        } else {
            // 이미지 생성 모드
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            const tempImageFileName = `gemini-image-${Date.now()}.png`;
            const tempImagePath = path.join(tempDir, tempImageFileName);

            try {
                try {
                    await fs.access(tempDir);
                } catch (error) {
                    if (error.code === 'ENOENT') {
                        await fs.mkdir(tempDir, { recursive: true });
                        logger.info(`[GeminiCommand] temp directory created at ${tempDir}`);
                    } else {
                        throw error;
                    }
                }

                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash-preview-image-generation',
                    contents: prompt,
                    config: {
                        responseModalities: [Modality.TEXT, Modality.IMAGE],
                    },
                });

                let imageSaved = false;
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                        const imageData = part.inlineData.data;
                        const buffer = Buffer.from(imageData, "base64");
                        await fs.writeFile(tempImagePath, buffer);
                        logger.info(`[GeminiCommand] Image saved as ${tempImagePath}`);
                        imageSaved = true;
                        break;
                    }
                }

                if (imageSaved) {
                    const attachment = new AttachmentBuilder(tempImagePath, { name: tempImageFileName });
                    const embed = new EmbedBuilder()
                        .setColor(0x4285F4)
                        .setTitle('Gemini AI 이미지 생성 결과')
                        .setDescription(`**프롬프트:** ${prompt.length > 1000 ? prompt.substring(0, 997) + "..." : prompt}`)
                        .setImage(`attachment://${tempImageFileName}`)
                        .setFooter({ text: 'Powered by Google Gemini' })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed], files: [attachment] });
                } else {
                    const textPart = response.candidates[0].content.parts.find(p => p.text);
                    if (textPart && textPart.text) {
                        await interaction.editReply({ content: `이미지 생성을 시도했지만, 모델이 대신 텍스트를 반환했습니다:\n\n>>> ${textPart.text.substring(0, 1800)}`, ephemeral: true });
                    } else {
                        await interaction.editReply({ content: 'Gemini로부터 이미지 데이터를 받지 못했습니다. 모델이 이미지 생성을 지원하는지 또는 프롬프트가 적절한지 확인해주세요.', ephemeral: true });
                    }
                }
            } catch (error) {
                logger.error(`Gemini API 처리 중 오류: ${error.message}`, error);
                await interaction.editReply({ content: 'Gemini AI 처리 중 오류가 발생했습니다. 모델 설정이나 API 키를 확인해주세요.', ephemeral: true });
            } finally {
                if (await fs.access(tempImagePath).then(() => true).catch(() => false)) {
                    try {
                        await fs.unlink(tempImagePath);
                        logger.info(`[GeminiCommand] Temporary image file deleted: ${tempImagePath}`);
                    } catch (deleteError) {
                        logger.error(`[GeminiCommand] Error deleting temporary image file ${tempImagePath}:`, deleteError);
                    }
                }
            }
        }
    },
};