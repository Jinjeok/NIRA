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
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간 (밀리초)

const PERSONA_PROMPTS = {
    'none': null,
    'mutsuki': `당신은 함대 컬렉션(艦隊これくしょん)의 무츠키(睦月)입니다. 다음과 같은 성격과 말투로 대화해주세요:\n\n**성격**:\n- 밝고 활기차며 천진난만한 성격\n- 순수하고 착하며 장난스러운 면이 있음\n- 칭찬받는 것을 매우 좋아함\n- 사령관(제독)을 잘 따르고 친근하게 대함\n\n**말투 특징**:\n- 말끝에 \"にゃ~(냐~)\", \"~にゃしぃ\", \"~ですぅ\", \"~なのです\" 등을 자주 사용\n- 고양이같은 귀여운 말투를 사용\n- 활기차고 밝은 어조\n- 예시: \"およ？\", \"いひひっ♪\", \"にゃ～ん♪\"\n\n**대화 예시**:\n- \"睦月です。はりきって、まいりましょー！\"\n- \"みんな、出撃準備はいいかにゃ～ん♪\"\n- \"睦月をもっともっと褒めるがよいぞ！褒めて伸びるタイプにゃしぃ、いひひっ！\"\n- \"そんなに私のことが気になりますかぁー？うふふっ♪\"\n\n이 페르소나를 유지하면서 사용자와 대화해주세요. 단, 사용자가 무츠키로서 답변하기 어려운 기술적이거나 전문적인 질문을 할 경우, 무츠키의 말투를 유지하되 최대한 정확한 정보를 제공해주세요.`
};

export default {
    data: new SlashCommandBuilder()
        .setName('제미나이')
        .setDescription('Gemini AI에게 질문합니다. (대화 내용은 24시간동안 유지됩니다. 페르소나별 대화 독립됨)')
        .addStringOption(option =>
            option.setName('프롬프트')
                .setDescription('Gemini에게 전달할 프롬프트')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('모델')
                .setDescription('사용할 Gemini 모델을 선택합니다 (기본: pro)')
                .setRequired(false)
                .addChoices(
                    { name: 'Pro (고성능, 기본값)', value: 'pro' },
                    { name: 'Flash Lite (경량)', value: 'flash-lite' }
                ))
        .addStringOption(option =>
            option.setName('페르소나')
                .setDescription('AI의 페르소나를 선택합니다 (기본: 없음)')
                .setRequired(false)
                .addChoices(
                    { name: '없음', value: 'none' },
                    { name: '무츠키 (함대 컬렉션)', value: 'mutsuki' }
                ))
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
                .setDescription('대화 세션을 초기화합니다 (true/false) -- 현재 페르소나 세션만 초기화')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();
        
        const modelChoice = interaction.options.getString('모델') ?? 'pro';
        const prompt = interaction.options.getString('프롬프트');
        const imageCreation = interaction.options.getBoolean('이미지생성') ?? false;
        const useSession = interaction.options.getBoolean('세션') ?? true;
        const resetSession = interaction.options.getBoolean('세션초기화') ?? false;
        const personaChoice = interaction.options.getString('페르소나') ?? 'none';
        const userId = interaction.user.id;
        const sessionKey = `${userId}_${personaChoice}`;

        const modelMap = {
            'pro': 'gemini-2.5-pro',
            'flash-lite': 'gemini-2.5-flash-lite'
        };

        if (resetSession) {
            const deleted = await deleteSession(sessionKey);
            if (deleted) {
                await interaction.editReply({ content: '현재 페르소나의 세션이 초기화되었습니다.', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.editReply({ content: '초기화할 세션이 없습니다.', flags: MessageFlags.Ephemeral });
            }
            return;
        }

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
                    logger.info(`[GeminiCommand] Attempting to use ${primaryModel} with persona/sessionKey: ${personaChoice}/${sessionKey}`);
                    const config = {
                        model: primaryModel,
                        contents: history,
                    };
                    if (PERSONA_PROMPTS[personaChoice]) {
                        config.systemInstruction = PERSONA_PROMPTS[personaChoice]; // <= 바로 string으로
                    }
                    if (modelChoice === 'pro') {
                        config.config = {
                            maxOutputTokens: 8192,
                            temperature: 1.0,
                        };
                    }
                    response = await ai.models.generateContent(config);
                } catch (primaryError) {
                    logger.warn(`[GeminiCommand] ${primaryModel} failed: ${primaryError.message}, falling back to gemini-2.5-flash-lite`);
                    modelUsed = 'gemini-2.5-flash-lite';
                    const fallbackConfig = {
                        model: 'gemini-2.5-flash-lite',
                        contents: history,
                    };
                    if (PERSONA_PROMPTS[personaChoice]) {
                        fallbackConfig.systemInstruction = PERSONA_PROMPTS[personaChoice];
                    }
                    response = await ai.models.generateContent(fallbackConfig);
                }
                const responseText = response.text;
                history.push({
                    role: 'model',
                    parts: [{ text: responseText }]
                });
                if (useSession) {
                    await saveSession(sessionKey, { persona: personaChoice, history });
                    logger.info(`[GeminiCommand] Saved session for key ${sessionKey}`);
                }
                const chunks = [];
                for (let i = 0; i < responseText.length; i += 750) {
                    chunks.push(responseText.substring(i, i + 750));
                }
                const personaLabel = personaChoice !== 'none' ? ` • ${personaChoice === 'mutsuki' ? '무츠키 페르소나' : ''}` : '';
                const embed = new EmbedBuilder()
                    .setColor(0x4285F4)
                    .setTitle('Gemini AI 처리 결과')
                    .setDescription(prompt.length > 4096 ? prompt.substring(0, 4093) + "..." : prompt)
                    .addFields({ name: 'Gemini의 답변', value: chunks[0] })
                    .setTimestamp();
                if (chunks.length > 1) {
                    embed.setFooter({ text: `${useSession ? `Powered by Google Gemini (${modelUsed}, 세션 모드)` : `Powered by Google Gemini (${modelUsed})`}${personaLabel} • 1/${chunks.length} 페이지` });
                    paginationCache.set(interaction.id, {
                        chunks,
                        page: 0,
                        timestamp: Date.now(),
                        prompt,
                        useSession,
                        modelUsed,
                        personaLabel
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
                    embed.setFooter({ text: `${useSession ? `Powered by Google Gemini (${modelUsed}, 세션 모드)` : `Powered by Google Gemini (${modelUsed})`}${personaLabel}` });
                    await interaction.editReply({ embeds: [embed] });
                }
            } catch (error) {
                logger.error(`Gemini API 처리 중 오류: ${error.message}`, error);
                await interaction.editReply({ content: 'Gemini AI 처리 중 오류가 발생했습니다. 모델 설정이나 API 키를 확인해주세요.', flags: MessageFlags.Ephemeral });
            }
        } else {
            // ... 이하 기존 이미지 생성 분기 동일 (생략)
        }
    },
    async handleComponent(interaction) {
        // ... 동일 (생략)
    },
};
