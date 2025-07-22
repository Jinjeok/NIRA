import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import fs from 'fs/promises'; // fs/promises for async operations
import path from 'path'; // path 모듈 추가
import { GoogleGenAI, Modality } from "@google/genai";
import logger from '../logger.js'; // 프로젝트에 로거가 있다면 사용하세요.
import { fileURLToPath } from 'node:url'; // __dirname 대체용

// ES 모듈에서 __dirname을 사용하기 위한 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// .env 파일에서 API 키를 로드합니다.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// genAI 인스턴스는 execute 함수 내에서 API 키 확인 후 생성합니다.

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
                .setRequired(false)),
    async execute(interaction) {
        // API 호출 전에 응답을 지연시킵니다.
        await interaction.deferReply();
        //persona 작성
        const prompt = interaction.options.getString('프롬프트');
        const imageCreation = interaction.options.getBoolean('이미지생성') ?? false;

        if(!imageCreation) {
            try {
                // 참고: 현재 ai.models.generateContent 및 response.text 사용 방식과
                // 'gemini-2.0-flash-lite' 모델명은 사용하시는 @google/genai SDK 버전에 따라 다를 수 있습니다.
                // 공식 @google/generative-ai SDK 사용 방식과 일반적인 모델명을 확인하시는 것이 좋습니다.
                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash-lite', // 유효한 모델명으로 변경 필요할 수 있음 (예: 'gemini-1.5-flash-latest')
                    contents: prompt,
                });
                
                const embed = new EmbedBuilder()
                    .setColor(0x4285F4) // Google Blue
                    .setTitle('Gemini AI 처리 결과')
                    .setDescription(prompt.length > 240 ? prompt.substring(0, 237) + "..." : prompt) 
                    .addFields({ name: 'Gemini AI의 답변', value: response.text && typeof response.text === 'string' ? (response.text.length > 1024 ? response.text.substring(0, 1021) + "..." : response.text) : "응답을 받지 못했습니다." }) 
                    .setFooter({ text: 'Powered by Google Gemini' })
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                logger.error(`Gemini API 처리 중 오류: ${error.message}`, error);
                await interaction.editReply({ content: 'Gemini AI 처리 중 오류가 발생했습니다. 모델 설정이나 API 키를 확인해주세요.', ephemeral: true });
            }

        } else {
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            const tempImageFileName = `gemini-image-${Date.now()}.png`;
            const tempImagePath = path.join(tempDir, tempImageFileName);

            try {
                // temp 폴더가 없으면 생성
                try {
                    await fs.access(tempDir);
                } catch (error) {
                    if (error.code === 'ENOENT') {
                        await fs.mkdir(tempDir, { recursive: true });
                        logger.info(`[GeminiCommand] temp directory created at ${tempDir}`);
                    } else {
                        throw error; // 다른 접근 오류는 다시 던짐
                    }
                }

                // 참고: 현재 ai.models.generateContent 및 response.text 사용 방식과
                // 'gemini-2.0-flash-lite' 모델명은 사용하시는 @google/genai SDK 버전에 따라 다를 수 있습니다.
                // 공식 @google/generative-ai SDK 사용 방식과 일반적인 모델명을 확인하시는 것이 좋습니다.
                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash-preview-image-generation', // 유효한 모델명으로 변경 필요할 수 있음 (예: 'gemini-1.5-flash-latest')
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
                        await fs.writeFile(tempImagePath, buffer); // 비동기 writeFile 사용
                        logger.info(`[GeminiCommand] Image saved as ${tempImagePath}`);
                        imageSaved = true;
                        break; // 첫 번째 이미지만 저장하고 루프 종료
                    }
                }

                if (imageSaved) {
                    const attachment = new AttachmentBuilder(tempImagePath, { name: tempImageFileName });
                    const embed = new EmbedBuilder()
                        .setColor(0x4285F4) // Google Blue
                        .setTitle('Gemini AI 이미지 생성 결과')
                        .setDescription(`**프롬프트:** ${prompt.length > 1000 ? prompt.substring(0, 997) + "..." : prompt}`)
                        .setImage(`attachment://${tempImageFileName}`)
                        .setFooter({ text: 'Powered by Google Gemini' })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed], files: [attachment] });
                } else {
                    // 이미지 데이터가 없는 경우의 처리 (텍스트 응답이 있다면 그것을 보여줄 수도 있음)
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
                // 임시 파일 삭제 시도
                if (fs.existsSync && await fs.access(tempImagePath).then(() => true).catch(() => false)) { // 파일 존재 확인 후 삭제
                    try {
                        await fs.unlink(tempImagePath);
                        logger.info(`[GeminiCommand] Temporary image file deleted: ${tempImagePath}`);
                    } catch (deleteError) {
                        logger.error(`[GeminiCommand] Error deleting temporary image file ${tempImagePath}:`, deleteError);
                    }
                }
            }

        }


        // if (!apiKey) {
        //     logger.error('Gemini API 키가 설정되지 않았습니다.');
        //     return interaction.reply({ content: 'Gemini API 키가 설정되지 않아 명령을 실행할 수 없습니다. 관리자에게 문의하세요.', ephemeral: true });
        // }
        //     const result = await activeModel.generateContent(requestPayload);

        //     genAIResponse = result.response.text;

        //     if (!genAIResponse) {
        //         logger.error('Gemini API로부터 유효한 응답을 받지 못했습니다 (genAIResponse is null/undefined).');
        //         await interaction.editReply({ content: 'Gemini API로부터 응답을 받지 못했습니다. 잠시 후 다시 시도해주세요.', ephemeral: true });
        //         return;
        //     }

        //     if (createImage) {
        //         const imagePart = genAIResponse.candidates?.[0]?.content?.parts?.find(part => part.inlineData && part.inlineData.mimeType?.startsWith('image/'));

        //         if (imagePart) {
        //             const { data, mimeType: imageMimeType } = imagePart.inlineData;
        //             const imageBuffer = Buffer.from(data, 'base64');
        //             const attachmentName = `gemini-image.${imageMimeType.split('/')[1] || 'png'}`;
        //             const attachment = new AttachmentBuilder(imageBuffer, { name: attachmentName });

        //             const embed = new EmbedBuilder()
        //                 .setColor(0x4285F4) // Google Blue
        //                 .setTitle('Gemini AI 이미지 생성 결과')
        //                 .setDescription(`**프롬프트:** ${prompt.length > 1000 ? prompt.substring(0, 997) + "..." : prompt}`)
        //                 .setImage(`attachment://${attachmentName}`)
        //                 .setFooter({ text: 'Powered by Google Gemini' })
        //                 .setTimestamp();
        //             await interaction.editReply({ embeds: [embed], files: [attachment] });
        //         } else {
        //             logger.warn(`Gemini (이미지 생성 모드): 프롬프트 "${prompt}"에 대해 이미지 데이터가 없습니다.`);
        //             const textResponse = genAIResponse.text?.();
        //             if (textResponse) {
        //                 await interaction.editReply({ content: `이미지 생성을 시도했지만, 모델이 대신 텍스트를 반환했습니다:\n\n>>> ${textResponse.substring(0, 1800)}`, ephemeral: true });
        //             } else {
        //                 const blockReason = genAIResponse.promptFeedback?.blockReason;
        //                 if (blockReason) {
        //                      await interaction.editReply({ content: `Gemini가 안전상의 이유로 콘텐츠를 생성할 수 없습니다 (이유: ${blockReason}). 다른 프롬프트를 사용해보세요.`, ephemeral: true });
        //                 } else {
        //                      await interaction.editReply({ content: 'Gemini로부터 이미지 데이터를 받지 못했습니다. 모델이 이미지 생성을 지원하는지 또는 프롬프트가 적절한지 확인해주세요.', ephemeral: true });
        //                 }
        //             }
        //         }
        //     } else {
        //         const text = genAIResponse.text?.();
        //         if (text) {
        //             // Discord 메시지 길이 제한 (2000자) 및 Embed 설명 길이 제한 (4096자) 고려
        //             const embed = new EmbedBuilder()
        //                 .setColor(0x4285F4) // Google Blue
        //                 .setTitle('Gemini AI 처리 결과')
        //                 .setDescription(prompt.length > 240 ? prompt.substring(0, 237) + "..." : prompt) 
        //                 .addFields({ name: 'Gemini AI의 답변', value: text.length > 1024 ? text.substring(0, 1021) + "..." : text }) 
        //                 .setFooter({ text: 'Powered by Google Gemini' })
        //                 .setTimestamp();
        //             await interaction.editReply({ embeds: [embed] });
        //         } else {
        //             const blockReason = genAIResponse.promptFeedback?.blockReason;
        //              if (blockReason) {
        //                   await interaction.editReply({ content: `Gemini가 안전상의 이유로 응답을 생성할 수 없습니다 (이유: ${blockReason}). 다른 프롬프트를 사용해보세요.`, ephemeral: true });
        //              } else {
        //                   await interaction.editReply({ content: 'Gemini로부터 유효한 텍스트 응답을 받지 못했습니다. 프롬프트나 API 상태를 확인해주세요.', ephemeral: true });
        //              }
        //         }
        //     }
        // } catch (error) {
        //     logger.error(`Gemini 명령어 실행 중 오류 발생: ${error.message}`, error);
        //     let replyMessage = 'Gemini와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        //     if (error.message.includes('API key not valid')) {
        //         replyMessage = 'Gemini API 키가 유효하지 않습니다. 관리자에게 문의하세요.';
        //     } else if (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('rate limit')) {
        //         replyMessage = 'Gemini API 사용량이 한도에 도달했거나 요청 빈도가 너무 높습니다. 잠시 후 다시 시도해주세요.';
        //     } else if (genAIResponse && genAIResponse.promptFeedback && genAIResponse.promptFeedback.blockReason) { // SAFETY 관련 블록 확인
        //         replyMessage = `Gemini가 안전상의 이유로 응답을 생성할 수 없습니다 (이유: ${genAIResponse.promptFeedback.blockReason}). 다른 프롬프트를 시도해주세요.`;
        //     } else if (error.message.toLowerCase().includes("model not found") || error.message.includes("does not exist")) {
        //         replyMessage = `지정된 Gemini 모델을 찾을 수 없습니다. 관리자에게 문의하여 모델 설정을 확인해주세요.`;
        //     }
        //     if (interaction.deferred || interaction.replied) {
        //         await interaction.editReply({ content: replyMessage, ephemeral: true });
        //     } else {
        //         await interaction.reply({ content: replyMessage, ephemeral: true }); // deferReply 전에 오류 발생 시
        //     }
        // }
    },
};