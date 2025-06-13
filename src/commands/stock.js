// d:/Users/KHM/OneDrive/Documents/dev/NIRA/src/commands/주식.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { searchStock } from '../utils/stock_search.js'; // stock.js 파일의 상대 경로를 새 위치로 변경

export default {
    data: new SlashCommandBuilder()
        .setName('주식')
        .setDescription('지정한 종목의 현재 주식 정보를 검색합니다.')
        .addStringOption(option =>
            option.setName('종목명')
                .setDescription('검색할 주식의 이름 (예: 삼성전자)')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('상세')
                .setDescription('상세 정보를 보려면 true로 설정하세요. (기본값: 간략 정보)')
                .setRequired(false)),
    async execute(interaction, client, logger) {
        const stockName = interaction.options.getString('종목명');
        const showDetailed = interaction.options.getBoolean('상세') ?? false;

        try {
            // 사용자에게 시간이 걸릴 수 있음을 알림 (Defer Reply)
            await interaction.deferReply();

            const stockResults = await searchStock(stockName, logger);

            if (!stockResults) {
                logger.error(`주식 정보 검색 실패: ${stockName} (API 응답 없음 또는 오류)`);
                await interaction.editReply(`"${stockName}"에 대한 주식 정보를 가져오는 중 오류가 발생했습니다. API 키 또는 서비스 상태를 확인해주세요.`);
                return;
            }

            if (stockResults.length === 0) {
                await interaction.editReply(`"${stockName}"에 대한 주식 정보를 찾을 수 없습니다. 종목명을 확인해주세요.`);
                return;
            }

            // 첫 번째 결과 사용
            const stock = stockResults[0];

            // 등락률에 따라 색상 결정
            const fluctuationRate = parseFloat(stock.fltRt);
            let embedColor;

            if (fluctuationRate > 0) {
                embedColor = 0xFF0000; // Red for increase
            } else if (fluctuationRate < 0) {
                embedColor = 0x0000FF; // Blue for decrease (can keep default or make it a different blue)
            } else {
                embedColor = 0x808080; // Gray for no change
            }

            let embed;

            if (showDetailed) {
                embed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle(`📈 ${stock.itmsNm} (${stock.srtnCd}) 상세 주식 정보`)
                    .setDescription(`기준일: ${stock.basDt}`)
                    .addFields(
                        { name: '현재가 (종가)', value: `${Number(stock.clpr).toLocaleString()}원`, inline: true },
                        { name: '시가', value: `${Number(stock.mkp).toLocaleString()}원`, inline: true },
                        { name: '고가', value: `${Number(stock.hipr).toLocaleString()}원`, inline: true },
                        { name: '저가', value: `${Number(stock.lopr).toLocaleString()}원`, inline: true },
                        { name: '등락률', value: `${stock.fltRt}%`, inline: true },
                        { name: '거래량', value: `${Number(stock.trqu).toLocaleString()}주`, inline: true }
                    );
                if (stock.vs) { // 전일비
                    embed.addFields({ name: '전일 대비', value: `${Number(stock.vs).toLocaleString()}원`, inline: true });
                }
                embed.addFields({ name: '시가총액', value: `${Number(stock.mrktTotAmt).toLocaleString()}원`, inline: false })
                    .setTimestamp()
                    .setFooter({ text: '제공: 금융위원회 공공데이터포털\n\n면책조항: 제공되는 정보는 투자 참고자료이며, 투자 결정 및 결과에 대한 책임은 투자자 본인에게 있습니다.' });
            } else {
                embed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle(`📊 ${stock.itmsNm} (${stock.srtnCd}) 주식 정보`)
                    .setDescription(`기준일: ${stock.basDt}`)
                    .addFields(
                        { name: '현재가', value: `${Number(stock.clpr).toLocaleString()}원`, inline: true }
                    );
                if (stock.vs) { // 전일비
                    embed.addFields({ name: '전일 대비', value: `${Number(stock.vs).toLocaleString()}원`, inline: true });
                }
                embed.addFields({ name: '등락률', value: `${stock.fltRt}%`, inline: true })
                    .setTimestamp()
                    .setFooter({ text: '제공: 금융위원회 공공데이터포털 | 상세 정보는 /주식 [종목명] 상세:True\n\n면책조항: 제공되는 정보는 투자 참고자료이며, 투자 결정 및 결과에 대한 책임은 투자자 본인에게 있습니다.' });
            }
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error(`'/주식' 명령어 처리 중 오류 발생: ${error.message}`, error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('주식 정보를 검색하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            } else {
                await interaction.reply('주식 정보를 검색하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            }
        }
    },
};