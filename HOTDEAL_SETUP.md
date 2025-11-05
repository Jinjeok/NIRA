# 핫딜 기능 설정 가이드

## 개요
기존의 일일 뉴스 자동 전송 기능을 아르카 라이브 핫딜 정보 전송으로 변경하였습니다.

## 변경사항

### 1. 새로운 파일들
- `src/commands/hotdeal.js` - 핫딜 슬래시 명령어
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
- 아르카 라이브 핫딜 채널에서 최신 핫딜 정보를 가져옵니다
- 상위 5개 핫딜을 Discord Embed로 표시
- 각 핫딜의 제목, 가격, 조회수, 추천수, 링크 정보 포함

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

### 6. 주의사항
- 아르카 라이브 웹사이트 구조 변경 시 파싱 로직 수정 필요
- 과도한 요청 시 IP 차단 가능성 있음
- 웹 스크래핑이므로 사이트 정책 준수 필요

### 7. 문제 해결
- 로그 확인: `[DailyHotdealSender]` 태그로 검색
- 파싱 실패 시 기본 메시지로 대체
- 웹훅 URL 오류 시 환경 변수 확인

## 개발자 노트
- `fetchHotdealEmbed()` 함수는 재사용 가능하도록 export됨
- 웹 파싱 방식으로 RSS가 아닌 직접 HTML 파싱 사용
- 기존 뉴스 기능은 완전히 제거됨 (필요시 백업 후 복구 가능)