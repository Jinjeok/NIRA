# 핫딜 기능 설정 가이드

## 개요
기존의 일일 뉴스 자동 전송 기능을 **에펨코리아 핫딜** 정보 전송으로 변경하였습니다.

## 변경사항

### 1. 새로운 파일들
- `src/commands/hotdeal.js` - 에펨코리아 핫딜 슬래시 명령어
- `src/schedule/dailyHotdealSender.js` - 일일 핫딜 자동 전송
- `src/schedule.js` - 스케줄러 업데이트 (뉴스 → 핫딜)

### 2. 필요한 패키지 설치
```bash
npm install cheerio
# 또는
yarn add cheerio
```

### 3. 기능 설명

#### 핫딜 명령어 (`/핫딜`)
- **소스**: 에펨코리아 핫딜 (https://www.fmkorea.com/hotdeal)
- **파싱 방식**: cheerio를 사용한 웹 스크래핑
- **표시 정보**: 상위 5개 핫딜을 Discord Embed로 표시
- **포함 데이터**:
  - 제목 (최대 80자)
  - 가격 정보
  - 쇼핑몰/출처
  - 작성 시간
  - 추천수 및 댓글수
  - 게시글 직접 링크

#### 자동 핫딜 전송
- **실행 시간**: 매일 9시, 15시, 21시 (하루 3번)
- **전송 방식**: Webhook 또는 채널 직접 전송
- **환경 변수**: `DAILYNEWS_WEBHOOK_URL` 재사용

### 4. 설정 방법

#### 웹훅 모드 (권장)
1. Discord 채널에서 웹훅 URL 생성
2. `.env` 파일에 `DAILYNEWS_WEBHOOK_URL=your_webhook_url` 추가
3. `src/schedule/dailyHotdealSender.js`에서 `SEND_MODE = "webhook"` 확인

#### 채널 모드
1. `src/schedule/dailyHotdealSender.js`에서 `SEND_MODE = "channel"` 변경
2. `CHANNEL_ID` 변수에 대상 채널 ID 입력

### 5. 스케줄 변경
`src/schedule/dailyHotdealSender.js`의 `CRON_EXPRESSION`을 수정하여 실행 시간을 변경할 수 있습니다:
- 현재: `'0 9,15,21 * * *'` (9시, 15시, 21시)
- 예시: `'0 */3 * * *'` (3시간마다)
- 예시: `'0 12 * * *'` (매일 정오)

### 6. 기술적 특징

#### 파싱 전략
- **1차 선택자**: `.fm_best_widget li`, `.hotdeal_var8 li`, `.bd_lst li`
- **2차 대체 선택자**: 일반적인 `li`, `.list-item`, `.item`, `article` 요소
- **데이터 추출**: 제목, 가격, 쇼핑몰, 시간, 추천수, 댓글수
- **링크 처리**: 상대경로를 절대경로로 변환

#### 안정성 기능
- **다단계 파싱**: 1차 선택자 실패 시 자동으로 2차 선택자 사용
- **폴백 시스템**: 파싱 완전 실패 시 기본 메시지로 대체
- **에러 처리**: 상세한 로그와 graceful degradation

### 7. 장점
- **안정성**: Cloudflare 차단 없이 정상 접근 가능
- **속도**: 빠른 응답 속도와 낮은 레이턴시
- **신뢰성**: 에펨코리아는 안정적인 한국 커뮤니티
- **데이터 품질**: 가격, 쇼핑몰, 추천수 등 상세 정보 제공

### 8. 주의사항
- 에펨코리아 웹사이트 구조 변경 시 파싱 로직 수정 필요
- 과도한 요청 시 IP 차단 가능성 있음 (현재는 문제없음)
- 웹 스크래핑이므로 사이트 정책 준수 필요
- 커뮤니티 이용규칙 준수 및 적절한 요청 빈도 유지

### 9. 문제 해결
- **로그 확인**: `[DailyHotdealSender]`, `[Hotdeal]` 태그로 검색
- **파싱 실패 시**: 기본 메시지로 대체 (직접 링크 안내)
- **웹훅 URL 오류 시**: 환경 변수 확인
- **파싱 오류**: 에펨코리아 페이지 구조 변경 가능성 확인

### 10. 치리오 선택자 상세

#### 기본 선택자
```javascript
$('.fm_best_widget li, .hotdeal_var8 li, .bd_lst li')
```

#### 대체 선택자 (기본 실패 시)
```javascript
$('li, .list-item, .item, article')
```

#### 데이터 추출 선택자
- **제목**: `'a[href*="/hotdeal/"], .title a, h3 a, .bd_tit a'`
- **가격**: `'.price, .won, .hotdeal_var8_price'`
- **쇼핑몰**: `'.shop, .site, .hotdeal_var8_site'`
- **시간**: `'.time, .date, .hotdeal_var8_date, .bd_time'`
- **추천수**: `'.like, .recommend, .bd_like'`
- **댓글수**: `'.comment, .reply, .bd_reply'`

## 개발자 노트
- `fetchHotdealEmbed()` 함수는 재사용 가능하도록 export됨
- 웹 파싱 방식으로 RSS가 아닌 직접 HTML 파싱 사용
- 기존 뉴스 기능은 완전히 제거됨 (필요시 백업 후 복구 가능)
- 다단계 파싱으로 사이트 구조 변경에 대한 상당한 내성 확보