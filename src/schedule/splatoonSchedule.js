const axios = require('axios');
const { EmbedBuilder } = require('discord.js'); // WebhookClient는 사용하지 않으므로 제거
const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');

// --- Splatoon Schedule Configuration ---
// SEND_MODE는 "channel"로 고정됩니다.
// WEBHOOK_URL은 더 이상 사용되지 않습니다.
const TARGET_CHANNEL_ID = process.env.SPLATOON_SCHEDULE_CHANNEL_ID; // .env 파일에서 채널 ID를 읽어옵니다.
//const CRON_EXPRESSION = '* * * * *'; // 매 홀수 시간 1분에 실행
const CRON_EXPRESSION = '1 1,3,5,7,9,11,13,15,17,19,21,23 * * *'; // 매 홀수 시간 1분에 실행
// --- End of Configuration ---

const messageIdStorePath = path.join(__dirname, '..', '..', 'temp', 'messageIdStore.json');
const MESSAGE_KEY_PREFIX = 'splatoonSchedule_'; // 메시지 ID 저장 시 사용할 키 접두사

async function getMessageId(channelIdentifierKey = 'default') {
    const key = `${MESSAGE_KEY_PREFIX}${channelIdentifierKey}`;
    try {
        const data = await fs.readFile(messageIdStorePath, 'utf8');
        const store = JSON.parse(data);
        return store[key];
    } catch (error) {
        // temp 폴더가 없는 경우 생성 시도
        if (error.code === 'ENOENT') {
            const tempDir = path.dirname(messageIdStorePath);
            try {
                await fs.access(tempDir); // 폴더 존재 확인
            } catch (accessError) { // 폴더가 없으면 accessError.code === 'ENOENT'
                if (accessError.code === 'ENOENT') {
                    await fs.mkdir(tempDir, { recursive: true });
                    logger.info(`[SplatoonSchedule] temp directory created at ${tempDir}`);
                } else { // 그 외 접근 오류
                    logger.error(`[SplatoonSchedule] Error accessing temp directory at ${tempDir}:`, accessError);
                    return null; 
                }
            }
        }
        if (error.code === 'ENOENT') { // 파일이 없을 경우
            logger.info(`[SplatoonSchedule] Message ID store file not found at ${messageIdStorePath}. Will create one.`);
            await fs.writeFile(messageIdStorePath, JSON.stringify({}), 'utf8');
            return null;
        }
        logger.error('[SplatoonSchedule] Error reading message ID store:', error);
        return null;
    }
}

async function setMessageId(id, channelIdentifierKey = 'default') {
    const key = `${MESSAGE_KEY_PREFIX}${channelIdentifierKey}`;
    try {
        let store = {};
        try {
            const data = await fs.readFile(messageIdStorePath, 'utf8');
            store = JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error; // 파일 없음 외의 오류는 다시 던짐
        }
        store[key] = id;
        await fs.writeFile(messageIdStorePath, JSON.stringify(store, null, 2), 'utf8');
    } catch (error) {
        logger.error('[SplatoonSchedule] Error writing message ID store:', error);
    }
}




async function getSplatoonData() {
    try {
        const resData = await Promise.all([
            axios.get('https://splatoon3.ink/data/locale/ko-KR.json').then((res) => { return res.data }),
            axios.get('https://splatoon3.ink/data/schedules.json').then((res) => { return res.data.data }),
        ]);
        return resData;
    } catch (error) {
        logger.error('[SplatoonSchedule] Error fetching Splatoon API data:', error);
        throw error; // 에러를 다시 던져서 호출한 쪽에서 처리하도록 함
    }
}

function dataTrim(data) {
    let locale = data[0];
    let schData = data[1];
    let returnData = [];

    // Bankara (Anarchy) Battles - Challenge & Open
    for (let j = 0; j < 2; j++) { // 0: Challenge, 1: Open
        let temp = { type: 'bankara', modeName: '', data: [] };
        const firstNodeSetting = schData.bankaraSchedules.nodes[0]?.bankaraMatchSettings?.[j];
        if (!firstNodeSetting) continue; 

        temp.modeName = firstNodeSetting.mode === 'CHALLENGE' ? '챌린지' : '오픈';

        for (let i = 0; i < 2; i++) { // Current and next schedule
            const scheduleNode = schData.bankaraSchedules.nodes[i];
            if (!scheduleNode) continue;
            const setting = scheduleNode.bankaraMatchSettings?.[j]; 
            if (!setting) continue;

            let pvpformat = {
                startTime: Date.parse(scheduleNode.startTime) / 1000,
                endTime: Date.parse(scheduleNode.endTime) / 1000,
                stages: [],
                rule: '',
                isFest: !!scheduleNode.festMatchSetting
            };
            pvpformat.stages = setting.vsStages.map(stage => ({
                name: locale.stages[stage.id]?.name || '알 수 없는 스테이지',
                imageUrl: stage.image?.url
            }));
            pvpformat.rule = locale.rules[setting.vsRule.id]?.name || '알 수 없는 규칙';
            temp.data.push(pvpformat);
        }
        if (temp.data.length > 0) returnData.push(temp);
    }

    // Regular Battle
    let regularTemp = { type: 'nawabari', data: [] };
    for (let i = 0; i < 2; i++) {
        const scheduleNode = schData.regularSchedules.nodes[i];
        if (!scheduleNode) continue;
        const setting = scheduleNode.regularMatchSetting;
        if (!setting) continue;
        let pvpformat = {
            startTime: Date.parse(scheduleNode.startTime) / 1000,
            endTime: Date.parse(scheduleNode.endTime) / 1000,
            stages: [],
            rule: '',
            isFest: !!scheduleNode.festMatchSetting
        };
        pvpformat.stages = setting.vsStages.map(stage => ({
            name: locale.stages[stage.id]?.name || '알 수 없는 스테이지',
            imageUrl: stage.image?.url
        }));
        pvpformat.rule = locale.rules[setting.vsRule.id]?.name || '알 수 없는 규칙';
        regularTemp.data.push(pvpformat);
    }
    if (regularTemp.data.length > 0) returnData.push(regularTemp);
    
    // Salmon Run
    if (schData.coopGroupingSchedule?.regularSchedules?.nodes) {
        for (let i = 0; i < Math.min(2, schData.coopGroupingSchedule.regularSchedules.nodes.length); i++) {
            const scheduleNode = schData.coopGroupingSchedule.regularSchedules.nodes[i];
            let pveformat = {
                startTime: Date.parse(scheduleNode.startTime) / 1000,
                endTime: Date.parse(scheduleNode.endTime) / 1000,
                stage: {
                    name: locale.stages[scheduleNode.setting.coopStage.id]?.name || '알 수 없는 스테이지',
                    image: scheduleNode.setting.coopStage.thumbnailImage?.url
                },
                weapons: scheduleNode.setting.weapons.map(w => locale.weapons[w.__splatoon3ink_id]?.name || '알 수 없는 무기'),
                type: 'salmon'
            };
            returnData.push(pveformat);
        }
    }

    // Event Battle
    if (schData.eventSchedules?.nodes) {
        for (let i = 0; i < Math.min(2, schData.eventSchedules.nodes.length); i++) {
            const eventNode = schData.eventSchedules.nodes[i];
            const setting = eventNode.leagueMatchSetting;
            if (!setting || !setting.leagueMatchEvent) continue;

            let eventformat = {
                timePeriods: [],
                stages: [],
                eventRule: { name: '', desc: '', regulation: '' },
                vsRule: '',
                type: 'event'
            };
            eventformat.timePeriods = eventNode.timePeriods.slice(0, 3).map(tp => ({
                startTime: Date.parse(tp.startTime) / 1000,
                endTime: Date.parse(tp.endTime) / 1000
            }));
            eventformat.stages = setting.vsStages.map(stage => locale.stages[stage.id]?.name || '알 수 없는 스테이지');
            eventformat.eventRule.name = locale.events[setting.leagueMatchEvent.id]?.name || '알 수 없는 이벤트';
            eventformat.eventRule.desc = locale.events[setting.leagueMatchEvent.id]?.desc || '';
            eventformat.eventRule.regulation = locale.events[setting.leagueMatchEvent.id]?.regulation.replace(/<br \/>/g,'\n').replace(/<[^>]*>?/gm, '') || '';
            eventformat.vsRule = locale.rules[setting.vsRule.id]?.name || '알 수 없는 규칙';
            returnData.push(eventformat);
        }
    }
    return returnData;
}

function formatToEmbeds(data) {
    let embeds = [];

    data.forEach((item, index) => {
        let embed = new EmbedBuilder();
        switch (item.type) {
            case 'nawabari':
                embed.setTitle('영역 배틀 (레귤러 매치)')
                     .setColor(0x00CD00); // Green
                item.data.forEach(d => {
                    embed.addFields({
                        name: `${d.stages.map(s => s.name).join(', ')} (${d.rule})`,
                        value: `<t:${d.startTime}:t> ~ <t:${d.endTime}:t> (<t:${d.endTime}:R>)`
                    });
                });
                if (item.data.length > 0 && item.data[0].stages[0].imageUrl) {
                    embed.setThumbnail(item.data[0].stages[0].imageUrl);
                }
                break;
            case 'bankara':
                embed.setTitle(`랭크 매치 (${item.modeName})`)
                     .setColor(item.modeName === '챌린지' ? 0xFF8C00 : 0xFF4500); // Orange / OrangeRed
                item.data.forEach(d => {
                    embed.addFields({
                        name: `${d.stages.map(s => s.name).join(', ')} (${d.rule})`,
                        value: `<t:${d.startTime}:t> ~ <t:${d.endTime}:t> (<t:${d.endTime}:R>)`
                    });
                });
                if (item.data.length > 0 && item.data[0].stages[0].imageUrl) {
                    embed.setThumbnail(item.data[0].stages[0].imageUrl);
                }
                break;
            case 'salmon':
                embed.setTitle(index === data.findIndex(d => d.type === 'salmon') ? '새먼 런' : '다음 새먼 런')
                     .setColor(0xFF69B4) // HotPink
                     .addFields({
                         name: `맵: ${item.stage.name}`,
                         value: `시간: <t:${item.startTime}:t> ~ <t:${item.endTime}:t> (<t:${item.endTime}:R>)\n무기: ${item.weapons.join(', ')}`
                     });
                if (item.stage.image) {
                    embed.setThumbnail(item.stage.image);
                }
                break;
            case 'event':
                embed.setTitle(`이벤트 매치: ${item.eventRule.name}`)
                     .setColor(0x8A2BE2) // BlueViolet
                     .setDescription(item.eventRule.regulation)
                     .addFields({ name: `스테이지: ${item.stages.join(', ')}`, value: `규칙: ${item.vsRule}`});
                item.timePeriods.forEach((tp, idx) => {
                    embed.addFields({
                        name: `${idx + 1}번째 일정`,
                        value: `<t:${tp.startTime}:F> ~ <t:${tp.endTime}:F> (<t:${tp.endTime}:R>)`
                    });
                });
                break;
        }
        if (embed.data.title) {
             embeds.push(embed);
        }
    });
    return embeds.slice(0, 10); // Discord 메시지당 최대 10개 Embed
}


async function sendSplatoonSchedule(client) {
    if (!TARGET_CHANNEL_ID) {
        logger.error('[SplatoonSchedule] SPLATOON_SCHEDULE_CHANNEL_ID 환경 변수가 설정되지 않았습니다. 스케줄을 중단합니다.');
        return;
    }

    logger.info(`[SplatoonSchedule] 스플래툰 일정 정보 전송 작업 시작 (채널 ID: ${TARGET_CHANNEL_ID})...`);
    let embedsToSend;
    try {
        const apiData = await getSplatoonData();
        const trimData = dataTrim(apiData);
        embedsToSend = formatToEmbeds(trimData);
        if (!embedsToSend || embedsToSend.length === 0) {
            logger.warn('[SplatoonSchedule] 생성된 Embed가 없습니다. API 데이터를 확인해주세요.');
            return;
        }
    } catch (error) {
        logger.error('[SplatoonSchedule] 스플래툰 데이터 처리 중 오류 발생:', error);
        return; 
    }
    try {
        // 항상 채널 모드로 동작
        const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
        if (!channel || !channel.isTextBased()) {
            logger.error(`[SplatoonSchedule] 설정된 채널 ID ${TARGET_CHANNEL_ID}를 찾을 수 없거나 텍스트 채널이 아닙니다.`);
            return;
        }

        // 메시지 ID는 채널 ID를 기반으로 한 키를 사용합니다.
        const messageIdKey = `${MESSAGE_KEY_PREFIX}${TARGET_CHANNEL_ID}`;
        const messageId = await getMessageId(messageIdKey);

        if (messageId) {
            try {
                const message = await channel.messages.fetch(messageId);
                await message.edit({ embeds: embedsToSend });
                logger.info(`[SplatoonSchedule] 채널 ${TARGET_CHANNEL_ID}의 메시지 ${messageId} 수정 완료.`);
            } catch (error) {
                logger.warn(`[SplatoonSchedule] 메시지 ${messageId} 수정 실패 (아마도 삭제됨), 새 메시지 전송 시도:`, error.message);
                const newMessage = await channel.send({ embeds: embedsToSend });
                await setMessageId(newMessage.id, messageIdKey);
                logger.info(`[SplatoonSchedule] 채널 ${TARGET_CHANNEL_ID}에 새 스플래툰 일정 메시지 전송 완료 (ID: ${newMessage.id}).`);
            }
        } else {
            const newMessage = await channel.send({ embeds: embedsToSend });
            await setMessageId(newMessage.id, messageIdKey);
            logger.info(`[SplatoonSchedule] 채널 ${TARGET_CHANNEL_ID}에 새 스플래툰 일정 메시지 전송 완료 (ID: ${newMessage.id}).`);
        }

     } catch (error) {
         logger.error(`[SplatoonSchedule] 스플래툰 일정 전송 중 오류 발생:`, error);
     }
}

module.exports = {
    sendSplatoonSchedule,
    CRON_EXPRESSION,
};
