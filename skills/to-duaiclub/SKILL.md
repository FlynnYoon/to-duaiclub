---
name: to-duaiclub
description: DUAI 동호회 점심 모임에서 오늘 작업한 결과물(요약, 스크린샷, 데모 영상)을 www.duaiclub.com 의 오늘 모임 일정에 자동으로 올린다. 사용자가 "/to-duaiclub", "DUAI에 올려줘", "duaiclub 업로드", "오늘 작업 홈페이지에 공유" 등을 요청하거나 작업을 마치고 동호회에 공유하려 할 때 사용한다.
---

# /to-duaiclub

작업이 끝난 뒤 이 스킬 하나로 **5분 안에** 결과물을 DUAI Club 홈페이지 오늘 모임 일정에 올린다.
사용자에게 묻는 것은 마지막 확인 한 번뿐이다. 나머지는 스스로 판단해 진행한다.

## 0. 실행 환경 판별

- **셸을 쓸 수 있다** (Claude Code, Codex CLI 등): 아래 "CLI 흐름"을 따른다.
- **셸은 없고 DUAI Club MCP 도구(`get_active_event`, `post_showcase` 등)가 있다** (ChatGPT, Claude 웹·앱): [references/web-and-app.md](references/web-and-app.md)를 따른다.
- **둘 다 없다**: 사용자에게 "설정 > 커넥터에 `https://www.duaiclub.com/mcp` 를 추가하고 DUAI Club 계정으로 로그인해 주세요"라고 안내하고 멈춘다.

## CLI 흐름

CLI는 `node "$HOME/.duaiclub/duai.mjs"` 이다 (이하 `duai`). 없으면 이 스킬 폴더의 `scripts/duai.mjs` 를 쓴다. 모든 출력은 JSON이다.

### 1. 준비 확인 (10초)

```bash
node "$HOME/.duaiclub/duai.mjs" doctor
```

- `hasToken`이 false이거나 `tokenValid`가 false면: 사용자에게 https://www.duaiclub.com/profile 의 "AI 스킬 연결"에서 토큰을 발급해 붙여 달라고 요청하고, 받으면 `duai login <토큰>`을 실행한다. 토큰을 요약이나 로그에 다시 출력하지 않는다.
- `playwright`/`chromium`이 false면 캡처 대신 결과 카드를 쓴다(아래 3단계). 설치는 사용자가 원할 때만 `hints`의 명령으로 한다.

### 2. 작업 파악과 초안 (1분)

`duai context`로 git 변경, 프로젝트 종류, 최근 생성된 이미지·영상을 확인하고 **이번 대화에서 한 일**과 합쳐 초안을 만든다.
요약은 **사용자에게 쓰라고 하지 않고 직접 작성한다.** 근거는 이번 대화 내용 → 오늘 커밋 메시지(`todayCommits`) → 변경 파일(`status`, `diffStat`) 순으로 쓴다.

- **제목**: 40자 이내. 무엇을 만들었는지 (예: "Claude Code로 사내 식단 추천 봇 만들기")
- **요약**: 정확히 3~4줄, 줄마다 `- `로 시작하고 한 줄은 60자 안팎. 댓글 본문에 그대로 들어간다.
  1. 오늘 만든 것·공부한 것 (결과 한 문장)
  2. 어떤 AI 도구를 어떻게 썼는지
  3. 핵심 구현 내용이나 새로 알게 된 것
  4. (선택) 막힌 점, 다음에 해볼 것

  예시:
  ```
  - 사내 식단표를 읽어 취향에 맞는 메뉴를 추천하는 슬랙 봇을 만들었습니다
  - Claude Code에게 크롤러와 추천 로직을 맡기고 프롬프트로 방향만 잡았습니다
  - 식단 PDF를 표로 바꾸는 부분이 가장 까다로웠고 pdfplumber로 해결했습니다
  - 다음에는 알레르기 필터를 추가해 볼 예정입니다
  ```
- 파일명·함수명 나열, "작업을 진행했습니다" 같은 빈 문장, 비밀정보는 쓰지 않는다.
- **링크**: GitHub 원격 저장소(공개일 때만), 배포 URL 등. `context.remote`가 사내 저장소처럼 보이면 넣지 않는다.
- **tool**: 사용한 도구 이름 (예: "Claude Code", "Codex CLI").

### 3. 스크린샷·영상 만들기 (2분 이내)

[references/capture-strategies.md](references/capture-strategies.md)에서 프로젝트 종류에 맞는 방법을 골라 실행한다. 요약하면:

| 결과물 | 명령 |
|---|---|
| 웹앱 (로컬) | `duai capture web --dev` (package.json의 dev 스크립트 자동 사용) 또는 `--dev "명령" --port 3000` |
| 배포된 웹 | `duai capture web --url https://...` |
| CLI·스크립트 | `duai capture terminal --cmd "실행 명령"` |
| 생성한 이미지·영상 | `context.recentMedia`의 파일을 그대로 사용 |
| 그 밖 / 캡처 실패 | `duai card --title ... --summary ... --tags ...` → 나온 `objectPath`를 `--objects`로 사용 |

- 이미지 1~3장 + 영상 최대 1개(15초 이하). 파일당 20MB 이하로 CLI가 자동 압축한다.
- 캡처가 한 번 실패하면 재시도하지 말고 결과 카드로 넘어간다. 시간 예산을 넘기지 않는 것이 우선이다.
- 캡처한 이미지는 직접 열어 보고 **비밀정보(API 키, .env, 토큰, 사내 기밀, 개인정보)가 보이면 쓰지 않는다.**

### 4. 올라갈 일정 확인

`duai event` 결과의 첫 번째 일정에 올라간다. 일정이 없으면 사용자에게 알리고 멈춘다(임의 일정에 올리지 않는다). 여러 개면 사용자에게 고르게 하고 `--event ID`를 쓴다.

### 5. 한 번만 확인받기

아래 형식으로 미리보기를 보여주고 "올릴까요?"라고 한 번만 묻는다. 사용자가 이미 "바로 올려" 등으로 확인을 생략하라고 했으면 건너뛴다.

```
[오늘의 작업] {제목}  →  {일정 제목}
{요약}
첨부: shot-1.jpg, demo-1280.mp4 (2.3MB)
링크: ...
```

수정 요청이 오면 반영하고 다시 묻지 말고 바로 올린다.

### 6. 올리기

```bash
node "$HOME/.duaiclub/duai.mjs" post --title "제목" --summary-file summary.md \
  --media shot-1.jpg,demo-1280.mp4 --captions "메인 화면|데모 영상" \
  --link https://github.com/... --tool "Claude Code"
```

- 요약은 따옴표 문제를 피하려고 임시 파일(`--summary-file`)로 넘긴다.
- 결과 카드는 `--objects /objects/uploads/...`로 넘긴다.
- 성공하면 `eventTitle`과 `url`을 사용자에게 알려준다: "오늘 모임 '{eventTitle}'에 올렸습니다: {url}"

## 오류 대응

| 증상 | 조치 |
|---|---|
| `needsLogin: true` | 1단계의 토큰 발급 안내 |
| `needsPlaywright: true` | 결과 카드로 대체 |
| "오늘 모임 일정을 찾을 수 없습니다" | 사용자에게 알리고, 일정 ID를 알려주면 `--event`로 재시도 |
| 413 / 50MB 초과 | `--no-video`로 다시 캡처하거나 영상을 빼고 올린다 |
| 네트워크 오류 | 한 번만 재시도, 실패하면 만든 파일 경로를 알려주고 종료 |
