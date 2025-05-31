# Nice, Intelligent, Resourceful, Assistant.

# 배포 방법
1. `.env` 파일 작성
2. `yarn deploy-commands`
3. `yarn start`


## 삭제 커맨드
- `yarn delete-commands`


# TODO
## 기능 관련
- [ ] 개발 환경 세팅 -> 저장시 실시간 재부팅 (nodemon 등)
- [ ] BOTY 마이그레이션
- [ ] 선택 기능 추가
- [ ] 확률 선택 기능 추가
- [ ] 주가 기능 추가
- [ ] 데이터베이스에 연결 필요
- [ ] .env 에 API 키 넣어두기
- [ ] 

## 문서 관련
- [ ] 문서 작성 (되도록이면 리액트로)
- [ ] 문서 도메인 커스터마이징 (nira.mutsuki.kr)

# .env 관련 내용
- `.env`는 민감한 정보를 포함하고 있기 때문에 gitignore를 통해 숨겨져 있습니다.
- `.env_example`의 내용을 직접 채워 `.env` 파일로 변경하여 사용해주세요.

------

# 버전 타임라인

## 0.0.0 ~ 0.1.0 2018_mini_1st_album (Tadashii Itsuwari Kara no Kisho)
### 0.0.1 Byoshin wo kamu
- 기초적인 서비스 작성
- 선택, 확률선택, 주가 명령어 생성
- 기존 봇의 기초적인 기능 마이그레이션
### 0.0.2 Humanoid
- 데이터베이스 연결
- 포트폴리오 기능 삽입
### 0.0.3 Saturn
- 