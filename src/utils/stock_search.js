// d:\Users\KHM\OneDrive\Documents\dev\NIRA\src\utils\stock.js

import path from 'path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
// Load environment variables from .env file
// .env 파일은 프로젝트 루트에 위치합니다.
// 이 파일(stock.js)이 src/utils/ 폴더에 위치하므로, 프로젝트 루트까지의 상대 경로는 '../../.env' 입니다.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// axios를 사용합니다.
import axios from 'axios';

const API_KEY = process.env.STOCK_KEY;
const API_URL = 'http://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo';

/**
 * Searches for stock information using the Korean stock market API.
 * @param {string} stockName The name of the stock to search for (e.g., "삼성전자").
 * @returns {Promise<Array<Object>|null>} A promise that resolves to an array of stock items, or null if an error occurs.
 * @param {object} logger - The logger instance for logging errors.
 */
export async function searchStock(stockName, logger) {
    if (!API_KEY) {
        logger.error("STOCK_KEY가 .env 파일에 정의되지 않았거나 로드되지 않았습니다. 경로 및 파일 내용을 확인해주세요.");
        logger.error(`.env 파일 로드 시도 기본 경로: ${path.resolve(__dirname, '../../.env')}`);
        return null;
    }

    // The service key from data.go.kr (if it's the "Encoding" version) needs to be URL decoded.
    // If your STOCK_KEY is the "Decoding" version, decodeURIComponent is generally harmless if no % characters exist.
    const decodedServiceKey = decodeURIComponent(API_KEY);

    const queryParams = new URLSearchParams({
        serviceKey: decodedServiceKey,
        itmsNm: stockName,      // Item name (e.g., stock name)
        numOfRows: 10,          // Number of results per page
        pageNo: 1,              // Page number
        resultType: 'json'      // Response format
    });

    const requestUrl = `${API_URL}?${queryParams.toString()}`;

    try {
        const response = await axios.get(requestUrl, { timeout: 10000 }); // 10초 타임아웃

        // axios는 2xx 범위 밖의 상태 코드에 대해 자동으로 에러를 발생시킵니다.
        // 따라서 별도의 response.ok 확인은 필요하지 않으며, 에러는 catch 블록에서 처리됩니다.
        const jsonResponse = response.data;

        if (!jsonResponse.response || !jsonResponse.response.header) {
            logger.error(`"${stockName}" 검색 API 응답 구조가 예상과 다릅니다. 'response' 또는 'response.header' 필드가 없습니다.`, jsonResponse);
            return null;
        }

        const header = jsonResponse.response.header;
        const body = jsonResponse.response.body;

        if (header.resultCode !== "00") {
            if (header.resultCode === "03") { // NODATA_ERROR
                logger.info(`"${stockName}" 검색 결과 데이터 없음 (API 코드: ${header.resultCode})`);
                return [];
            }
            logger.error(`API 오류: ${header.resultMsg} (코드: ${header.resultCode})`);
            if (["20", "21", "22", "30", "31", "32"].includes(header.resultCode)) {
                logger.error("STOCK_KEY (API 키) 문제, 권한 또는 사용량 제한 때문일 수 있습니다. .env 파일과 data.go.kr 포털에서 키를 확인해주세요.");
            }
            return null;
        }

        if (!body) {
            // resultCode 00 이지만 body가 없는 경우, 비정상으로 간주하고 null 반환 또는 에러 로깅
            logger.warn(`"${stockName}" 검색 API 호출 성공 (resultCode: 00)이지만 응답 body가 없습니다.`);
            return [];
        }

        if (body.totalCount === 0 || body.totalCount === "0" || body.items === "") {
            logger.info(`"${stockName}" 검색 결과, 총 개수 0 또는 items가 비어있습니다.`);
            return [];
        }

        if (body.items && typeof body.items === 'object' && body.items.item) {
            let stockList = body.items.item;
            // If there's only one item, the API might return it as an object instead of an array.
            if (!Array.isArray(stockList)) {
                stockList = [stockList];
            }
            return stockList;
        } else {
            logger.warn(`"${stockName}" 검색 결과, body.items 또는 body.items.item 구조가 예상과 다릅니다.`, body.items);
            return []; // Treat as no usable data found
        }

    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error(`"${stockName}" 주식 데이터 요청 중 Axios 오류 발생: ${error.message}`);
            if (error.response) {
                logger.error(` - 상태: ${error.response.status}, 데이터: ${JSON.stringify(error.response.data)}`);
            } else if (error.request) {
                logger.error(' - 요청은 이루어졌으나 응답을 받지 못했습니다.');
            }
        } else {
            logger.error(`"${stockName}" 주식 데이터 요청 중 예기치 않은 오류 발생: ${error.message}`);
        }
        return null;
    }
}

// Example usage (you can run this file directly with `node src/utils/stock.js` to test):
/*
(async () => {
    const stockNameToSearch = "삼성전자"; // Example: Samsung Electronics
    // 테스트용 임시 로거
    const tempLogger = {
        info: console.log,
        warn: console.warn,
        error: console.error
    };
    const stockInfo = await searchStock(stockNameToSearch, tempLogger);

    if (stockInfo && stockInfo.length > 0) {
        console.log(`Found information for ${stockNameToSearch}:`);
        stockInfo.forEach(stock => {
            console.log(`----------------------------------------`);
            console.log(`  종목명 (Item Name): ${stock.itmsNm} (${stock.srtnCd})`);
            console.log(`  기준일자 (Date): ${stock.basDt}`);
            console.log(`  종가 (Closing Price): ${Number(stock.clpr).toLocaleString()}원`);
            console.log(`  등락률 (Fluctuation Rate): ${stock.fltRt}%`);
            console.log(`  시가총액 (Market Cap): ${Number(stock.mrktTotAmt).toLocaleString()}원`);
        });
    } else if (stockInfo) { // Empty array means no results, not an error
        console.log(`No results found for "${stockNameToSearch}".`);
    } else { // Null means an error occurred
        console.log(`Failed to retrieve stock information for "${stockNameToSearch}".`);
    }
})();
*/

// export default { searchStock }; // 변경: named export를 사용하므로 이 줄은 제거하거나 주석 처리합니다.