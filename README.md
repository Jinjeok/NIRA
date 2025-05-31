# Nice, Intelligent, Resourceful, Assistant.

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

## 0.0.0 ~ 0.1.0 2018_mini_1st_album (Tadashii Itsuwari Kara no Kisho)
### 0.0.1 Byoshin wo kamu
- 기초적인 서비스 작성
- 선택, 확률선택, 주가 명령어 생성
- 기존 봇의 기초적인 기능 마이그레이션
#### 상세 패치노트 (문서로 옮길 예정)
1. 기존 기능 마이그레이션
    - `calc`는 보안상 위험한 `eval()`을 제거한 후 `math.js` 도입 후 `calculation`으로 마이그레이션 완료.
    - `coin`은 기존에 string을 입력받던 것을 option으로 전부 삽입하여 찾기 쉬워짐.
    - `emoji`는 지울까말까 하다 결국 안지움
    - `english`, `nihongo`, `korean` 을 전부 `random_letter`로 통합
    - 몇몇 간단한 기능을 제외한 모든 기능에 Embed 적용 (ai의 디자인 센스 포함)
    - `serverinfo` 삭제
    - `shimul`과 `try`를 `simulation`으로 통합 
    - `vxtwitter` 기능 추가
    - `day`에서 `d-day` 기능으로 변경
    - `utc`기능 삭제 (`clock`기능을 사용해주세요)
2. 신기능 추가
    - 확률 선택 추가! 확률을 조작해서 선택해보세요!
    - 초대하기 기능 추가! NIRA 봇을 퍼뜨리세요!
    - 제미나이 기능 추가! 채신기술을 써보세요!
### 0.0.2 Humanoid
- 데이터베이스 연결
- 포트폴리오 기능 삽입
### 0.0.3 Saturn
- 스풀래툰 기능 삽입