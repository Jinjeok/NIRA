---
sidebar_position: 1
---

# 자동 스케줄

NIRA가 정해진 시간에 자동으로 실행하는 작업들입니다.

## Daily Hotdeal Sender

**설명:** 편집 운영에 channel 권장

**실행 시간:**
- `0 9,15,21 * * *` - 0 9,15,21 * * *

**카테고리:** hotdeal

---

## Daily News Sender

**설명:** __dirname 대체용

**실행 시간:**
- `0 9 * * *` - 매일 오전 9시

**카테고리:** news

---

## Karaoke Sender

**설명:** karaokeSender.js

**실행 시간:**
- `0 9 * * *` - 매일 오전 9시

**카테고리:** entertainment

---

## Splatoon Schedule

**설명:** WebhookClient는 사용하지 않으므로 제거

**실행 시간:**
- `* * * * *` - * * * * *
- `1 1,3,5,7,9,11,13,15,17,19,21,23 * * *` - 1 1,3,5,7,9,11,13,15,17,19,21,23 * * *

**카테고리:** gaming

---

