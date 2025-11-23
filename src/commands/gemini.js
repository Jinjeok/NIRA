import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenAI, Modality } from "@google/genai";
import logger from '../logger.js';
import { fileURLToPath } from 'node:url';
import { loadSession, saveSession, deleteSession } from '../utils/sessionManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const paginationCache = new Map();
const CACHE_TTL = 60 * 1000; // 1분

export default {
    data: new SlashCommandBuilder()
        .setName('제미나이')
        .setDescription('Gemini AI에게 질문합니다. (대화 내용은 1시간동안 유지됩니다.)')
        .addStringOption(option =>
            option.setName('모델')
                .setDescription('사용할 Gemini 모델을 선택합니다 (기본: pro)')
                .setRequired(false)
                .addChoices(
                    { name: 'Pro (고성능, 기본값)', value: 'pro' },
                    { name: 'Flash Lite (경량)', value: 'flash-lite' }
                ))
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
                .setDescription('대화 세션을 유지합니다 (true/false, 기본: true)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('세션초기화')
                .setDescription('대화 세션을 초기화합니다 (true/false)')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();
        
        const modelChoice = interaction.options.getString('모델') ?? 'pro';
        const prompt = interaction.options.getString('프롬프트');
        const imageCreation = interaction.options.getBoolean('이미지생성') ?? false;
        const useSession = interaction.options.getBoolean('세션') ?? true;
        const resetSession = interaction.options.getBoolean('세션초기화') ?? false;
        const userId = interaction.user.id;

        // 모델 선택에 따른 모델명 매핑
        const modelMap = {
            'pro': 'gemini-2.5-pro',
            'flash-lite': 'gemini-2.5-flash-lite'
        };

        // 세션 초기화 요청 처리
        if (resetSession) {
            const deleted = await deleteSession(userId);
            if (deleted) {
                await interaction.editReply({ content: '세션이 초기화되었습니다.', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.editReply({ content: '초기화할 세션이 없습니다.', flags: MessageFlags.Ephemeral });
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

                let response;
                const primaryModel = modelMap[modelChoice];
                let modelUsed = primaryModel;
                
                // Gemini API 호출 - 선택한 모델로 먼저 시도
                try {
                    logger.info(`[GeminiCommand] Attempting to use ${primaryModel}`);
                    
                    const config = {
                        model: primaryModel,
                        contents: history,
                    };
                    // Pro 모델인 경우에만 토큰 제한 설정
                    if (modelChoice === 'pro') {
                        config.config = {
                            maxOutputTokens: 8192,
                            temperature: 1.0,
                        };
                    }
                    response = await ai.models.generateContent(config);
                } catch (primaryError) {
                    // 선택한 모델 실패 시 flash-lite로 재시도
                    logger.warn(`[GeminiCommand] ${primaryModel} failed: ${primaryError.message}, falling back to gemini-2.5-flash-lite`);
                    modelUsed = 'gemini-2.5-flash-lite';
                    response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash-lite',
                        contents: history,
                    });
                }

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
                
                const chunks = [];
                for (let i = 0; i < responseText.length; i += 750) {
                    chunks.push(responseText.substring(i, i + 750));
                }

                const embed = new EmbedBuilder()
                    .setColor(0x4285F4)
                    .setTitle('Gemini AI 처리 결과')
                    .setDescription(prompt.length > 4096 ? prompt.substring(0, 4093) + "..." : prompt)
                    .addFields({ 
                        name: 'Gemini의 답변', 
                        value: chunks[0]
                    })
                    .setTimestamp();

                if (chunks.length > 1) {
                    embed.setFooter({ text: `${useSession ? `Powered by Google Gemini (${modelUsed}, 세션 모드)` : `Powered by Google Gemini (${modelUsed})`} • 1/${chunks.length} 페이지` });
                    
                    paginationCache.set(interaction.id, {
                        chunks,
                        page: 0,
                        timestamp: Date.now(),
                        prompt,
                        useSession,
                        modelUsed
                    });

                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`gemini_prev:${interaction.id}`)
                                .setLabel('이전')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId(`gemini_next:${interaction.id}`)
                                .setLabel('다음')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(false)
                        );

                    await interaction.editReply({ embeds: [embed], components: [row] });

                    setTimeout(() => {
                        paginationCache.delete(interaction.id);
                        interaction.editReply({ components: [] }).catch(() => {});
                    }, CACHE_TTL);

                } else {
                    embed.setFooter({ text: useSession ? `Powered by Google Gemini (${modelUsed}, 세션 모드)` : `Powered by Google Gemini (${modelUsed})` });
                    await interaction.editReply({ embeds: [embed] });
                }
            } catch (error) {
                logger.error(`Gemini API 처리 중 오류: ${error.message}`, error);
                await interaction.editReply({ content: 'Gemini AI 처리 중 오류가 발생했습니다. 모델 설정이나 API 키를 확인해주세요.', flags: MessageFlags.Ephemeral });
            }
        } else {
            // 이미지 생성 모드 - gemini-2.0-flash-lite 사용
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
                    model: 'gemini-2.0-flash-lite', // 이미지 생성용 모델
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
                        await interaction.editReply({ content: `이미지 생성을 시도했지만, 모델이 대신 텍스트를 반환했습니다:\n\n>>> ${textPart.text.substring(0, 1800)}`, flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.editReply({ content: 'Gemini로부터 이미지 데이터를 받지 못했습니다. 모델이 이미지 생성을 지원하는지 또는 프롬프트가 적절한지 확인해주세요.', flags: MessageFlags.Ephemeral });
                    }
                }
            } catch (error) {
                logger.error(`Gemini API 처리 중 오류: ${error.message}`, error);
                await interaction.editReply({ content: 'Gemini AI 처리 중 오류가 발생했습니다. 모델 설정이나 API 키를 확인해주세요.', flags: MessageFlags.Ephemeral });
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

    async handleComponent(interaction) {
        const [action, originalInteractionId] = interaction.customId.split(':');
        const cacheData = paginationCache.get(originalInteractionId);

        if (!cacheData) {
            await interaction.update({ content: '세션이 만료되었습니다.', components: [], embeds: [] });
            return;
        }

        let { chunks, page, prompt, useSession, modelUsed } = cacheData;
        
        if (action === 'gemini_prev') {
            page = Math.max(0, page - 1);
        } else if (action === 'gemini_next') {
            page = Math.min(chunks.length - 1, page + 1);
        }

        cacheData.page = page;
        
        const embed = new EmbedBuilder()
            .setColor(0x4285F4)
            .setTitle('Gemini AI 처리 결과')
            .setDescription(prompt.length > 4096 ? prompt.substring(0, 4093) + "..." : prompt)
            .addFields({ 
                name: 'Gemini의 답변', 
                value: chunks[page]
            })
            .setFooter({ text: `${useSession ? `Powered by Google Gemini (${modelUsed}, 세션 모드)` : `Powered by Google Gemini (${modelUsed})`} • ${page + 1}/${chunks.length} 페이지` })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`gemini_prev:${originalInteractionId}`)
                    .setLabel('이전')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId(`gemini_next:${originalInteractionId}`)
                    .setLabel('다음')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === chunks.length - 1)
            );

        await interaction.update({ embeds: [embed], components: [row] });
    },
};
