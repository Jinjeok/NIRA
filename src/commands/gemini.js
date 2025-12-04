import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenAI, Modality } from "@google/genai";
import logger from '../logger.js';
import { fileURLToPath } from 'node:url';
import { loadSession, saveSession, deleteSession } from '../utils/sessionManager.js';
import { saveConversation, loadConversation } from '../utils/conversationManager.js';
import { createPaginationButtons } from '../utils/paginationManager.js';
import { PERSONA_PROMPTS, PERSONA_CHOICES } from '../utils/personas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Start cleanup schedule
// startCleanupSchedule(); // Moved to index.js to prevent hang in deploy-commands

const processingSessions = new Set();
// const paginationCache = new Map(); // Removed in favor of file persistence
// const CACHE_TTL = 24 * 60 * 60 * 1000; // Handled by ConversationManager



export default {
    data: new SlashCommandBuilder()
        .setName('제미나이')
        .setDescription('Gemini AI에게 질문합니다. (대화 내용은 24시간동안 유지됩니다. 페르소나별 대화 독립됨)')
        .addStringOption(option =>
            option.setName('프롬프트')
                .setDescription('Gemini에게 전달할 프롬프트')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('페르소나')
                .setDescription('AI의 페르소나를 선택합니다 (기본: 없음)')
                .setRequired(false)
                .addChoices(...PERSONA_CHOICES))
        .addStringOption(option =>
            option.setName('모델')
                .setDescription('사용할 Gemini 모델을 선택합니다 (기본: pro)')
                .setRequired(false)
                .addChoices(
                    { name: 'Pro (고성능, 기본값)', value: 'pro' },
                    { name: 'Flash Lite (경량)', value: 'flash-lite' },
                    { name: 'Flash Lite Search (검색)', value: 'flash-lite-search' }
                ))
        .addBooleanOption(option =>
            option.setName('이미지생성')

                .setDescription('Gemini에게 이미지 생성을 요청합니다 (true/false).')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('세션모드')
                .setDescription('대화 세션 모드를 설정합니다 (기본: 켜기)')
                .setRequired(false)
                .addChoices(
                    { name: '켜기', value: 'on' },
                    { name: '끄기', value: 'off' },
                    { name: '공용세션', value: 'public' }
                ))
        .addBooleanOption(option =>
            option.setName('세션초기화')
                .setDescription('대화 세션을 초기화합니다 (true/false) -- 현재 페르소나 세션만 초기화')
                .setRequired(false)),
    async execute(interaction) {
        const modelChoice = interaction.options.getString('모델') ?? 'pro';
        const personaChoice = interaction.options.getString('페르소나') ?? 'none';

        if (modelChoice === 'flash-lite-search' && personaChoice !== 'none') {
            return interaction.reply({ content: '현재 검색 모델과 페르소나는 동시에 사용할 수 없습니다.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply();
        
        const prompt = interaction.options.getString('프롬프트');
        const imageCreation = interaction.options.getBoolean('이미지생성') ?? false;
        const sessionMode = interaction.options.getString('세션모드') ?? 'on';
        const useSession = sessionMode !== 'off';
        const resetSession = interaction.options.getBoolean('세션초기화') ?? false;
        const userId = interaction.user.id;
        
        let sessionKey;
        if (sessionMode === 'public') {
            sessionKey = `public_${personaChoice}`;
        } else {
            sessionKey = `${userId}_${personaChoice}`;
        }

        const modelMap = {
            'pro': 'gemini-2.5-pro',
            'flash-lite': 'gemini-2.5-flash-lite',
            'flash-lite-search': 'gemini-2.5-flash-lite'
        };

        if (resetSession) {
            if (sessionMode === 'public') {
                return interaction.editReply({ content: '공용 세션은 초기화할 수 없습니다.', flags: MessageFlags.Ephemeral });
            }
            const deleted = await deleteSession(sessionKey);
            if (deleted) {
                await interaction.editReply({ content: '현재 페르소나의 세션이 초기화되었습니다.', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.editReply({ content: '초기화할 세션이 없습니다.', flags: MessageFlags.Ephemeral });
            }
            return;
        }



        if (useSession && processingSessions.has(sessionKey)) {
            return interaction.editReply({ content: '현재 이 세션에서 다른 요청을 처리 중입니다. 잠시 후 다시 시도해주세요.', flags: MessageFlags.Ephemeral });
        }

        if (useSession) {
            processingSessions.add(sessionKey);
        }

        try {
            if (!imageCreation) {
                try {
                    let history = [];
                    if (useSession) {
                        const session = await loadSession(sessionKey);
                        if (session && Array.isArray(session.history)) {
                            history = session.history;
                            logger.info(`[GeminiCommand] Loaded session for key ${sessionKey} with ${history.length} messages`);
                        }
                    }
                history.push({
                    role: 'user',
                    parts: [{ text: prompt }]
                });

                let response;
                const primaryModel = modelMap[modelChoice];
                let modelUsed = primaryModel;

                try {
                    let retryCount = 0;
                const maxRetries = 3;

                while (retryCount <= maxRetries) {
                    try {
                        logger.info(`[GeminiCommand] Attempting to use ${primaryModel} with persona/sessionKey: ${personaChoice}/${sessionKey} (Attempt ${retryCount + 1})`);
                        const config = {
                            model: primaryModel,
                            contents: history,
                            config: {}
                        };
                        if (PERSONA_PROMPTS[personaChoice]) {
                            config.config.systemInstruction = PERSONA_PROMPTS[personaChoice].prompt;
                        }
                        if (modelChoice === 'pro') {
                            config.config = {
                                ...config.config,
                                maxOutputTokens: 8192,
                                temperature: 1.0,
                            };
                        }
                        if (modelChoice === 'flash-lite-search') {
                            config.config = {
                                ...config.config,
                                tools: [{ googleSearch: {} }]
                            };
                        }
                        
                        response = await ai.models.generateContent(config);
                        break; // Success
                    } catch (error) {
                        if (error.message.includes('503') && retryCount < maxRetries) {
                            retryCount++;
                            logger.warn(`[GeminiCommand] 503 error on ${primaryModel}, retrying (${retryCount}/${maxRetries})...`);
                            await interaction.editReply({ content: `재시도 중입니다 (${retryCount}/${maxRetries})` });
                            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
                            continue;
                        }
                        throw error;
                    }
                }
                } catch (primaryError) {
                    logger.warn(`[GeminiCommand] ${primaryModel} failed: ${primaryError.message}, falling back to gemini-2.5-flash-lite`);
                    modelUsed = 'gemini-2.5-flash-lite';
                    const fallbackConfig = {
                        model: 'gemini-2.5-flash-lite',
                        contents: history,
                        config: {}
                    };
                    if (PERSONA_PROMPTS[personaChoice]) {
                        fallbackConfig.config.systemInstruction = PERSONA_PROMPTS[personaChoice].prompt;
                    }
                    response = await ai.models.generateContent(fallbackConfig);
                }
                const responseText = response.text;
                history.push({
                    role: 'model',
                    parts: [{ text: responseText }]
                });
                if (useSession) {
                    await saveSession(sessionKey, history);
                    logger.info(`[GeminiCommand] Saved session for key ${sessionKey}`);
                }
                const chunks = [];
                for (let i = 0; i < responseText.length; i += 750) {
                    chunks.push(responseText.substring(i, i + 750));
                }

                const personaLabel = (personaChoice !== 'none' && PERSONA_PROMPTS[personaChoice]) ? ` • ${PERSONA_PROMPTS[personaChoice].label} 페르소나` : '';
                const embed = new EmbedBuilder()
                    .setColor(0x4285F4)
                    .setTitle('Gemini AI 처리 결과')
                    .setDescription(prompt.length > 4096 ? prompt.substring(0, 4093) + "..." : prompt)
                    .addFields({ name: 'Gemini의 답변', value: chunks[0] })
                    .setTimestamp();
                if (chunks.length > 1) {
                    embed.setFooter({ text: `${useSession ? `Powered by Google Gemini (${modelUsed}, ${sessionMode === 'public' ? '공용 세션' : '세션 모드'})` : `Powered by Google Gemini (${modelUsed})`}${modelChoice === 'flash-lite-search' ? ' (검색 모델)' : ''}${personaLabel} • 1/${chunks.length} 페이지` });
                    
                    await saveConversation(interaction.id, {
                        chunks,
                        page: 0,
                        timestamp: Date.now(),
                        prompt,
                        useSession,
                        modelUsed: modelUsed + (modelChoice === 'flash-lite-search' ? ' (검색 모델)' : ''),
                        personaLabel
                    });

                    const row = createPaginationButtons(0, chunks.length, interaction.id, 'gemini_page_');
                    await interaction.editReply({ embeds: [embed], components: [row] });
                    await interaction.editReply({ embeds: [embed], components: [row] });
                } else {
                    embed.setFooter({ text: `${useSession ? `Powered by Google Gemini (${modelUsed}, ${sessionMode === 'public' ? '공용 세션' : '세션 모드'})` : `Powered by Google Gemini (${modelUsed})`}${modelChoice === 'flash-lite-search' ? ' (검색 모델)' : ''}${personaLabel}` });
                    await interaction.editReply({ embeds: [embed] });
                }
            } catch (error) {
                logger.error(`Gemini API 처리 중 오류: ${error.message}`, error);
                await interaction.editReply({ content: 'Gemini AI 처리 중 오류가 발생했습니다. 모델 설정이나 API 키를 확인해주세요.', flags: MessageFlags.Ephemeral });
            }
        } else {
            // ... 이하 기존 이미지 생성 분기 동일 (생략)
        }
    } finally {
        if (useSession) {
            processingSessions.delete(sessionKey);
        }
    }
    },
    async handleComponent(interaction) {
        logger.info(`[GeminiCommand] handleComponent called with customId: ${interaction.customId}`);
        try {
            const [action, originalInteractionId] = interaction.customId.split(':');
            
            const data = await loadConversation(originalInteractionId);
            
            if (!data) {
                return interaction.reply({ content: '이 대화의 세션이 만료되었습니다.', flags: MessageFlags.Ephemeral });
            }

            let { chunks, page, prompt, useSession, modelUsed, personaLabel } = data;

            if (action.startsWith('gemini_page_')) {
                const pageIndex = parseInt(action.replace('gemini_page_', ''), 10);
                if (!isNaN(pageIndex) && pageIndex >= 0 && pageIndex < chunks.length) {
                    page = pageIndex;
                }
            }

            // Update page in stored data
            data.page = page;
            await saveConversation(originalInteractionId, data);

            const embed = new EmbedBuilder()
                .setColor(0x4285F4)
                .setTitle('Gemini AI 처리 결과')
                .setDescription(prompt.length > 4096 ? prompt.substring(0, 4093) + "..." : prompt)
                .addFields({ name: 'Gemini의 답변', value: chunks[page] })
                .setTimestamp()
                .setFooter({ text: `${useSession ? `Powered by Google Gemini (${modelUsed}, 세션 모드)` : `Powered by Google Gemini (${modelUsed})`}${personaLabel} • ${page + 1}/${chunks.length} 페이지` });

            const row = createPaginationButtons(page, chunks.length, originalInteractionId, 'gemini_page_');

            await interaction.update({ embeds: [embed], components: [row] });
        } catch (error) {
            logger.error(`[GeminiCommand] Error in handleComponent: ${error.message}`, error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '버튼 처리 중 오류가 발생했습니다.', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.followUp({ content: '버튼 처리 중 오류가 발생했습니다.', flags: MessageFlags.Ephemeral });
            }
        }
    },
};


