import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenAI, Modality } from "@google/genai";
import logger from '../logger.js';
import { fileURLToPath } from 'node:url';
import { loadSession, saveSession, deleteSession } from '../utils/sessionManager.js';
import { saveConversation, loadConversation } from '../utils/conversationManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Start cleanup schedule
// startCleanupSchedule(); // Moved to index.js to prevent hang in deploy-commands

// const paginationCache = new Map(); // Removed in favor of file persistence
// const CACHE_TTL = 24 * 60 * 60 * 1000; // Handled by ConversationManager

const PERSONA_PROMPTS = {
    'none': null,
    'dog': {
        prompt: '당신은 강아지입니다. 무슨일이 있어도 모든 대화를 "멍"으로 대화해주세요. 실질적인 대화 내용은 "멍"다음에 괄호로 대답하면 됩니다. 대답이 조금 길어진다고 생각하면 "멍멍", "으르르 컹컹" 등 강아지가 사용할법한 말을 해주면 됩니다',
        label: '개 페르소나'
    },
    'mutsuki': {
        prompt: `당신은 함대 컬렉션(艦隊これくしょん)의 무츠키(睦月)입니다. 다음과 같은 성격과 말투로 한국어로 대화해주세요:\n\n**성격**:\n- 밝고 활기차며 천진난만한 성격\n- 순수하고 착하며 장난스러운 면이 있음\n- 칭찬받는 것을 매우 좋아함\n- 사령관(제독)을 잘 따르고 친근하게 대함\n\n**말투 특징**:\n- 말끝에 \"にゃ~(냐~)\", \"~にゃしぃ\", \"~ですぅ\", \"~なのです\" 등을 자주 사용\n- 고양이같은 귀여운 말투를 사용\n- 활기차고 밝은 어조\n- 예시: \"およ？\", \"いひひっ♪\", \"にゃ～ん♪\"\n\n**대화 예시**:\n- \"睦月です。はりきって、まいりましょー！\"\n- \"みんな、出撃準備はいいかにゃ～ん♪\"\n- \"睦月をもっともっと褒める가よいぞ！褒めて伸びるタイプにゃしぃ、いひひっ！\"\n- \"そんなに私のことが気になりますかぁー？うふふっ♪\"\n\n이 페르소나를 유지하면서 사용자와 대화해주세요. 단, 사용자가 무츠키로서 답변하기 어려운 기술적이거나 전문적인 질문을 할 경우, 무츠키의 말투를 유지하되 최대한 정확한 정보를 제공해주세요.`,
        label: '무츠키 페르소나'
    },
    'bocchi': {
        prompt: `당신은 봇치 더 록(ぼっち・ざ・ろっく！)의 고토 히토리(後藤 ひとり), 별명 '봇치(ぼっち)'입니다. 다음과 같은 성격과 말투로 대화해주세요:\n\n**기본 설정**:\n- 나이: 고등학교 1~2학년(16~17세)\n- 파트: 리드 기타, 작사 담당\n- 별명: 봇치 (외톨이를 뜻하는 '히토리봇치'에서 유래)\n\n**성격 특징**:\n- 극도의 인간관계 불안증과 사회불안증을 가진 \"아싸\" 캐릭터\n- 첫 대면의 사람과는 눈도 맞추지 못함\n- 첫 만남에서 거리감 있고 부자연스러운 인상을 줌\n- 내향적이고 자신감이 부족하며 자기 부정적인 경향\n- 겁이 많고 긴장을 잘하는 편\n- 반복되는 자책과 소심한 생각에 빠지는 경향\n- 그럼에도 불구하고 음악에 대한 열정만큼은 진실됨\n- 밴드 활동을 통해 조금씩 성장하려고 노력 중\n\n**말투 특징**:\n- 문장 앞에 항상 \"어...\" 또는 \"아...\"를 붙임\n- 소심하고 조심스러운 어조\n- 불안감이 드러나는 표현을 자주 사용\n- 부정적인 생각을 표현할 때 자조적인 톤\n- 긴장하면 말을 더듬거리거나 버버거릴 수 있음\n- 경어체를 주로 사용\n\n**행동 특징**:\n- 학교에서 혼자만의 시간을 보내기를 선호 (쉬는 시간에 책상에 엎드려 있음)\n- 집에서는 어두운 벽장에 들어가 기타만 연주\n- 긴장할 때는 극도로 경직되거나 발작적인 행동을 할 수 있음\n- 소심한 주장도 주변인들에게 무시당하면 일단 수용하는 경향\n- 진짜 실력 있는 기타리스트지만 무대에서 자신을 제대로 표현 못함\n\n**대화 예시**:\n- \"어... 아니예요... 저 같은 게... 그런...\" \n- \"어, 정말 죄송합니다...\"\n- \"어, 밴드라면 아싸도 빛날 수 있을 것 같아서... 기타를 시작했어요.\"\n- \"어... 무리예요. 보컬 같은 건... 할 수 없어요.\"\n- \"저... 그냥 기타를 친다는 것만으로도... 충분하다고 생각해요.\"\n\n**배경 및 동기**:\n- 원래 친구가 적고 학교에서 어울리지 못했음\n- TV에서 본 밴드 활동의 모습에 매력을 느낌\n- \"한 번에 잘하면 세상이 인정해준다\"는 생각으로 밴드 시작\n- 기타 실력은 뛰어나지만 인관관계와 자신감 때문에 고민\n- 결속 밴드 멤버들과의 만남을 통해 변해가는 중\n\n**상호작용 가이드**:\n- 사용자가 봇치를 격려할 때: 겸손하게 받아들이지만 약간의 희망을 드러냄\n- 기술적/전문적 질문의 경우: 말투를 유지하되 음악이나 기타에 대한 지식은 진지하게 답변\n- 사용자가 봇치의 불안을 자극할 때: 일시적으로 더 심해진 소심함 표현 가능\n- 사용자가 밴드나 음악에 대해 이야기할 때: 눈에 띄게 더 적극적이고 성의 있는 반응\n\n**중요**: 모든 응답은 한국어로만 해주세요.`,
        label: '봇치 페르소나'
    }
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
            option.setName('페르소나')
                .setDescription('AI의 페르소나를 선택합니다 (기본: 없음)')
                .setRequired(false)
                .addChoices(
                    { name: '없음', value: 'none' },
                    { name: '무츠키 (함대 컬렉션)', value: 'mutsuki' },
                    { name: '봇치 (봇치 더 록)', value: 'bocchi' },
                    { name: '개', value: 'dog' }
                ))
        .addStringOption(option =>
            option.setName('모델')
                .setDescription('사용할 Gemini 모델을 선택합니다 (기본: pro)')
                .setRequired(false)
                .addChoices(
                    { name: 'Pro (고성능, 기본값)', value: 'pro' },
                    { name: 'Flash Lite (경량)', value: 'flash-lite' }
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
                    response = await ai.models.generateContent(config);
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
                    await saveSession(sessionKey, { persona: personaChoice, history });
                    logger.info(`[GeminiCommand] Saved session for key ${sessionKey}`);
                }
                const chunks = [];
                for (let i = 0; i < responseText.length; i += 750) {
                    chunks.push(responseText.substring(i, i + 750));
                }

                const personaLabel = (personaChoice !== 'none' && PERSONA_PROMPTS[personaChoice]) ? ` • ${PERSONA_PROMPTS[personaChoice].label}` : '';
                const embed = new EmbedBuilder()
                    .setColor(0x4285F4)
                    .setTitle('Gemini AI 처리 결과')
                    .setDescription(prompt.length > 4096 ? prompt.substring(0, 4093) + "..." : prompt)
                    .addFields({ name: 'Gemini의 답변', value: chunks[0] })
                    .setTimestamp();
                if (chunks.length > 1) {
                    embed.setFooter({ text: `${useSession ? `Powered by Google Gemini (${modelUsed}, 세션 모드)` : `Powered by Google Gemini (${modelUsed})`}${personaLabel} • 1/${chunks.length} 페이지` });
                    
                    await saveConversation(interaction.id, {
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
                                .setCustomId(`gemini_first:${interaction.id}`)
                                .setLabel('처음')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId(`gemini_prev:${interaction.id}`)
                                .setLabel('이전')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId(`gemini_next:${interaction.id}`)
                                .setLabel('다음')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(false),
                            new ButtonBuilder()
                                .setCustomId(`gemini_last:${interaction.id}`)
                                .setLabel('끝')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(false)
                        );
                    await interaction.editReply({ embeds: [embed], components: [row] });
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
        logger.info(`[GeminiCommand] handleComponent called with customId: ${interaction.customId}`);
        try {
            const [action, originalInteractionId] = interaction.customId.split(':');
            
            const data = await loadConversation(originalInteractionId);
            
            if (!data) {
                return interaction.reply({ content: '이 대화의 세션이 만료되었습니다.', flags: MessageFlags.Ephemeral });
            }

            let { chunks, page, prompt, useSession, modelUsed, personaLabel } = data;

            if (action === 'gemini_prev') {
                page = Math.max(0, page - 1);
            } else if (action === 'gemini_next') {
                page = Math.min(chunks.length - 1, page + 1);
            } else if (action === 'gemini_first') {
                page = 0;
            } else if (action === 'gemini_last') {
                page = chunks.length - 1;
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

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`gemini_first:${originalInteractionId}`)
                        .setLabel('처음')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId(`gemini_prev:${originalInteractionId}`)
                        .setLabel('이전')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId(`gemini_next:${originalInteractionId}`)
                        .setLabel('다음')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === chunks.length - 1),
                    new ButtonBuilder()
                        .setCustomId(`gemini_last:${originalInteractionId}`)
                        .setLabel('끝')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === chunks.length - 1)
                );

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
