# Nice, Intelligent, Resourceful, Assistant.

## 운영 런타임

- `npm start` 또는 `yarn start`: 봇, 스케줄러, 관리자 페이지를 한 프로세스에서 함께 시작합니다.
- `npm run start:bot`: Discord 봇만 시작합니다.
- `npm run start:admin`: 관리자 페이지 API/UI만 시작합니다.
- `npm run migrate:local-state`: 기존 `data/`, `temp/` 기반 상태를 SQLite DB로 마이그레이션합니다.

기본 DB 경로는 `data/nira.sqlite`이며, `NIRA_DB_PATH`로 바꿀 수 있습니다. 관리자 페이지는 기본적으로 `http://127.0.0.1:3100`에서 열립니다.

## 관리자 페이지 인증

관리자 페이지는 Google OAuth로 로그인합니다.

- Google Cloud OAuth Client의 redirect URI에 `http://127.0.0.1:3100/auth/google/callback` 또는 `GOOGLE_AUTH_REDIRECT_URI` 값을 등록합니다.
- `.env`에 `GOOGLE_AUTH_CLIENT_ID`, `GOOGLE_AUTH_CLIENT_SECRET`을 설정합니다.
- `GOOGLE_AUTH_ALLOWED_EMAILS` 또는 `GOOGLE_AUTH_ALLOWED_DOMAINS` 중 하나는 반드시 설정합니다.
- 인증 실패가 `ADMIN_AUTH_FAILURE_WINDOW_HOURS` 시간 안에 `ADMIN_AUTH_FAILURE_LIMIT`회 이상 발생하면 해당 IP는 `admin_ip_bans`에 영구 밴으로 기록됩니다.
- `ADMIN_AUTH_WHITELIST_IPS`에 등록한 IP 또는 IPv4 CIDR은 실패 로그는 남지만 밴되지 않습니다. 루프백 IP는 기본 whitelist이며, `ADMIN_AUTH_WHITELIST_LOOPBACK=false`로 끌 수 있습니다.
- 리버스 프록시 뒤에서 외부 공개할 때는 실제 클라이언트 IP를 보려면 `ADMIN_TRUST_PROXY=true`를 켜고, 프록시/루프백이 무조건 whitelist 처리되지 않도록 운영 환경의 whitelist를 다시 확인합니다.
- 개발 환경에서는 `npm run dev`/`yarn dev`가 `ADMIN_AUTH_BYPASS=true`와 `NODE_ENV=development`를 자동 적용하므로 Google 로그인을 건너뜁니다.
- 모든 Google 인증 성공/실패는 `admin_auth_logs`에 남습니다.

## 런타임 코드명

- bot: `Kan Saete Kuyashiiwa (감이 좋아서 분해)`
- scheduler: `MILABO`
- admin: `Hanaichi Monnme (하나이치몬메)`

# 봇 요구사항
- MongoDB
- 공공데이터센터 API 키 (금융위원회_주식시세정보)
- Gemini API 키


# 배포 방법
1. `.env` 파일 작성
2. `yarn deploy-commands`
3. `yarn start`


## 삭제 커맨드
- `yarn delete-commands`


# TODO
## 기능 관련
- [x] 개발 환경 세팅 -> 저장시 실시간 재부팅 (nodemon 등)
- [x] BOTY 마이그레이션
- [x] 선택 기능 추가
- [x] 확률 선택 기능 추가
- [x] 주가 기능 추가
- [ ] 데이터베이스에 연결 필요
- [ ] 포트폴리오 기능 추가
- [x] .env 에 API 키 넣어두기


## 문서 관련
- [ ] 문서 작성 (되도록이면 리액트로)
- [ ] 문서 도메인 커스터마이징 (nira.mutsuki.kr)

# .env 관련 내용
- `.env`는 민감한 정보를 포함하고 있기 때문에 gitignore를 통해 숨겨져 있습니다.
- `.env_example`의 내용을 직접 채워 `.env` 파일로 변경하여 사용해주세요.

------

# 버전 타임라인

> 기준: `git log --date=short --reverse`와 현재 작업 중인 파일 변경사항.
> 코드명은 [ZUTOMAYO 공식 `RELEASE` 목록](https://zutomayo.net/release/)의 앨범/미니앨범 순서를 따릅니다.
> 정규앨범은 대형 메이저 업데이트, 미니앨범은 메이저 업데이트, 각 수록곡은 마이너 업데이트 코드명으로 사용합니다.

## 0.x Pre-Full Album Era

정규앨범으로 올라가기 전, NIRA의 뼈대와 첫 운영 기능을 만드는 구간입니다.

### 0.1.0 `正しい偽りからの起床` / Tadashii Itsuwari Kara no Kisho

종류: 미니앨범 기반 메이저 업데이트  
기간: 2025-05-24 ~ 2025-06-01

- `0.1.1` `秒針を噛む`: 저장소, README, `.gitignore`, GitHub Pages/CNAME 기반 생성.
- `0.1.2` `ヒューマノイド`: Discord 봇 구동 구조와 slash command 기반 작성.
- `0.1.3` `サターン`: 기존 봇의 기본 기능을 NIRA 명령어로 마이그레이션.
- `0.1.4` `雲丹と栗`: 명령어 색상, Embed 출력, 초기 UX 조정.
- `0.1.5` `脳裏上のクラッカー`: Docusaurus 문서 실험과 배포 설정 정리.
- `0.1.6` `君がいて水になる`: `0.0.1` 기준의 구동 가능한 기본 봇 완성.

### 0.2.0 `今は今で誓いは笑みで` / Ima wa Ima de Chikai wa Emi de

종류: 미니앨범 기반 메이저 업데이트  
기간: 2025-06-01 ~ 2025-07-22

- `0.2.1` `勘冴えて悔しいわ`: Gemini 명령어 추가.
- `0.2.2` `正義`: 복권/확률 계열 기능 조정.
- `0.2.3` `またね幻`: 긴 응답과 메시지 처리 방식의 기반 확장.
- `0.2.4` `マイノリティ脈絡`: 뉴스 전송 작업과 스케줄러 생성.
- `0.2.5` `彷徨い酔い温度`: 스플래툰 스케줄 전송 작업 추가.
- `0.2.6` `眩しいDNAだけ`: `choice` 계열 정리, 가라오케 feeder, `.env` 기반 운영 설정 확대.

## 1.0.0 `潜潜話` / Hisohiso Banashi

종류: 1st full album 기반 대형 메이저 업데이트  
기간: 2025-11-05 ~ 2025-11-06  
테마: 콘텐츠 소스, 스케줄 전송, 문서 자동화

- `1.0.1` `脳裏上のクラッカー`: 핫딜 명령어 추가.
- `1.0.2` `勘冴えて悔しいわ`: Arca Live/FMKorea 소스 실험과 Cloudflare 우회 개선.
- `1.0.3` `居眠り遠征隊`: PPOMPPU RSS 기반으로 소스 안정화.
- `1.0.4` `ハゼ馳せる果てるまで`: 아침 신규 전송과 시간별 수정 작업 분리.
- `1.0.5` `蹴っ飛ばした毛布`: 메시지 ID 추적과 페이지네이션 버튼 추가.
- `1.0.6` `Dear. Mr「F」`: 핫딜 Embed 포맷, 캐시, 버튼 만료 정책 정리.
- `1.0.7` `こんなこと騒動`: 배포 환경과 `.env` 문서 보강.
- `1.0.8` `眩しいDNAだけ`: Docusaurus 문서 구조 정리.
- `1.0.9` `ヒューマノイド`: 명령어/스케줄 자동 문서 생성기 추가.
- `1.0.10` `グラスとラムレーズン`: 문서 파라미터/choices 추출 개선.
- `1.0.11` `正義`: blog/tutorial 샘플 제거.
- `1.0.12` `優しくLAST SMILE`: 문서 루트 랜딩과 GitHub Pages 흐름 정리.
- `1.0.13` `秒針を噛む`: 자동 문서화 안정화.

### 1.1.0 `朗らかな皮膚とて不服` / Hogaraka na Hifu Tote Fufuku

종류: 미니앨범 기반 메이저 업데이트  
기간: 2025-11-22 ~ 2025-12-04  
테마: AI 대화, 세션, persona, Perplexity

- `1.1.1` `低血ボルト`: Gemini 세션 저장 유틸리티 추가.
- `1.1.2` `お勉強しといてよ`: Gemini 세션 기반 대화와 응답 페이지네이션 확장.
- `1.1.3` `Ham`: 모델 선택, token limit, fallback 처리 보강.
- `1.1.4` `JK BOMBER`: persona 옵션과 `systemInstruction` 적용 실험.
- `1.1.5` `マリンブルーの庭園`: 버튼 캐시와 conversation storage를 24시간 흐름으로 확장.
- `1.1.6` `MILABO`: Perplexity 명령어, 긴 응답 자르기, pagination 공통화.
- `1.1.7` `サターン [Acoustic ver.]`: 503/error detail 보정과 AI 응답 안정화.

## 2.0.0 `ぐされ` / Gusare

종류: 2nd full album 기반 대형 메이저 업데이트  
기간: 2026-01-04 ~ 2026-03-25  
테마: 정리, 안정성, 배송 조회

- `2.0.1` `胸の煙`: `choice` 명령어 재정리와 dependency 갱신.
- `2.0.2` `正しくなれない`: 전역 예외 처리와 로그 flush 처리 추가.
- `2.0.3` `お勉強しといてよ`: 명령어/스케줄 자동 문서화와 스케줄 관리 흐름 재정리.
- `2.0.4` `勘ぐれい`: API 오류 detail 추출 개선.
- `2.0.5` `はゔぁ`: 배송 조회 명령어 추가.
- `2.0.6` `機械油`: 국제 운송사 목록과 EMS 자동 감지 개선.
- `2.0.7` `暗く黒く`: 지원되지 않는 국제 조회의 오류 메시지 개선.
- `2.0.8` `MILABO`: 스케줄러 관리의 다음 확장을 위한 예약 슬롯.
- `2.0.9` `ろんりねす`: 명령어 권한/노출 정책 정리용 예약 슬롯.
- `2.0.10` `繰り返す収穫`: 반복 작업 관측성 개선용 예약 슬롯.
- `2.0.11` `過眠`: 장기 세션/캐시 정리 개선용 예약 슬롯.
- `2.0.12` `低血ボルト`: 사용량 제한과 rate-limit 개선용 예약 슬롯.
- `2.0.13` `奥底に眠るルーツ`: 오래된 기능 정리와 호환성 점검용 예약 슬롯.

### 2.1.0 `伸び仕草懲りて暇乞い` / Nobi Shigusa Korite Itomagoi

종류: 미니앨범 기반 메이저 업데이트  
상태: 현재 작업 중  
테마: 로컬 상태 DB 마이그레이션, 통합 런타임, 관리자 페이지

- `2.1.1` `違う曲にしようよ`: SQLite 기반 `settings`, 명령어 로그, scheduler log, 상태 저장소 추가.
- `2.1.2` `袖のキルト`: `data/`, `temp/` 기반 로컬 상태를 DB로 마이그레이션.
- `2.1.3` `あいつら全員同窓会`: `bot`, `scheduler`, `admin` 통합 시작 런타임과 코드명 레지스트리 추가.
- `2.1.4` `猫リセット`: scheduler registry, cron/timezone 변경, 수동 실행, run log, retention 추가.
- `2.1.5` `夜中のキスミ`: 관리자 페이지에서 명령어 관리, 실행 기록, 스케줄러 현황을 볼 수 있게 구성.
- `2.1.6` `ばかじゃないのに`: Google OAuth, 10회 실패 IP 영구 밴, whitelist, dev auth bypass 추가.

## 3.0.0 `沈香学` / Jinkougaku

종류: 3rd full album 기반 대형 메이저 업데이트  
계획: 컨테이너화와 운영 경계 분리

- `3.0.1` `花一匁`: 같은 이미지에서 `bot`, `scheduler`, `admin`을 별도 entrypoint/service로 실행.
- `3.0.2` `残機`: DB 단일 writer, 백업, 복구 정책 확정.
- `3.0.3` `猫リセット`: 관리자 페이지 HTTPS, reverse proxy, 실제 client IP 정책 검증.
- `3.0.4` `綺羅キラー`: Docker Compose healthcheck와 service dependency 정리.
- `3.0.5` `馴れ合いサーブ`: scheduler 단독 컨테이너의 Discord client 의존성 재점검.
- `3.0.6` `あいつら全員同窓会`: 통합 실행과 분리 실행을 모두 지원하는 운영 문서 작성.
- `3.0.7` `夏枯れ`: container log/volume 경로 표준화.
- `3.0.8` `袖のキルト`: DB 마이그레이션 스크립트의 재실행 안전성 보강.
- `3.0.9` `不法侵入`: admin auth/ban/whitelist 보안 점검.
- `3.0.10` `ばかじゃないのに`: 배포 전 smoke test 자동화.
- `3.0.11` `消えてしまいそうです`: 장애 복구 절차 문서화.
- `3.0.12` `ミラーチューン`: 운영 환경 설정 템플릿 분리.
- `3.0.13` `上辺の私自身なんだよ`: 컨테이너 분리 릴리즈 마감.

### 3.1.0 `虚仮の一念海馬に託す` / Koke no Ichinen Kaiba ni Takusu

종류: 미니앨범 기반 메이저 업데이트  
계획: 운영 관측성과 관리자 UX 강화

- `3.1.1` `虚仮にしてくれ`: 명령어/스케줄러/인증 로그 검색과 필터 추가.
- `3.1.2` `TAIDADA`: 로그 export와 retention preview 추가.
- `3.1.3` `クズリ念`: 실패한 스케줄 작업의 재시도와 수동 복구 흐름 추가.
- `3.1.4` `海馬成長痛`: 최근 실패 요약과 관리자 알림 추가.
- `3.1.5` `嘘じゃない`: `.env` 설정과 DB 설정의 책임 경계 정리.
- `3.1.6` `Blues in the Closet`: 어드민 화면의 세부 UX/상태 표시 개선.

## 4.0.0 `形藻土` / KEISOUDO

종류: 4th full album 기반 대형 메이저 업데이트  
계획: 안정 릴리즈

- `4.0.1` `地球存在しない説`: 1.0 후보 브랜치 생성과 릴리즈 체크리스트 고정.
- `4.0.2` `間人間`: DB 마이그레이션, 백업/복구 리허설.
- `4.0.3` `メディアノーチェ`: 운영 문서와 `.env_example` 최종 정리.
- `4.0.4` `TAIDADA`: 어드민 인증, IP 밴, whitelist 회귀 테스트.
- `4.0.5` `蟹しゃぶふぁんく`: scheduler/container smoke test.
- `4.0.6` `微熱魔`: 명령어 실행 로그와 retention 검증.
- `4.0.7` `クリームで会いにいけますか (Disco Re-Edit)`: 기존 로컬 상태 파일 의존 제거 확인.
- `4.0.8` `またね幻 (Live in Studio_80光年先の君へ)`: 통합 실행과 분리 실행 모두에서 docs 검증.
- `4.0.9` `シェードの埃は延長`: 배포 스크립트와 restart 정책 점검.
- `4.0.10` `形`: 1.0 stable cut.
- `4.0.11` `ultra魂`: 사후 운영 로그 리뷰.
- `4.0.12` `不死身の訓練`: 복구 훈련.
- `4.0.13` `海馬成長痛`: 성능/DB 잠금 점검.
- `4.0.14` `アンチモン`: 보안 설정 재점검.
- `4.0.15` `よもすがら`: 장기 운영 TODO 정리.
- `4.0.16` `クズリ念 (Live in Studio_温蔵庫)`: 릴리즈 노트 보강.
- `4.0.17` `嘘じゃない`: 실제 운영 반영 후 문서 차이 수정.
- `4.0.18` `lowmotion algae`: 안정 릴리즈 종료.
