# /to-duaiclub

DUAI 점심 모임에서 작업을 마친 뒤 `/to-duaiclub` 한 번이면, AI가 결과물을 요약하고 스크린샷·데모 영상을 만들어 [www.duaiclub.com](https://www.duaiclub.com) '활동 공유' 게시판에 올려줍니다. 목표 시간은 5분 이내입니다.

| 환경 | 방식 | 스크린샷·영상 |
|---|---|---|
| Claude Code, Codex CLI | 스킬 + 로컬 CLI | 자동 캡처(웹앱, 터미널), 영상 포함 |
| Claude 웹·앱 | 스킬 zip + MCP 커넥터 | 첨부 이미지 또는 결과 카드 |
| ChatGPT 웹·앱 | MCP 커넥터 | 첨부 이미지 또는 결과 카드 |

## Claude Code · Codex CLI

**처음 한 번만** 터미널에 아래 한 줄을 붙여넣습니다. 끝나면 브라우저가 열리니 DUAI Club에 로그인하고 '허용'을 누르세요.

- macOS / Linux: `curl -fsSL https://raw.githubusercontent.com/FlynnYoon/to-duaiclub/main/install.sh | bash`
- Windows PowerShell: `irm https://raw.githubusercontent.com/FlynnYoon/to-duaiclub/main/install.ps1 | iex`

그다음부터는 작업을 마치고 입력만 하면 됩니다. 요약·스크린샷·영상·업로드를 AI가 알아서 하고 링크를 알려줍니다.

- Claude Code: `/to-duaiclub`
- Codex CLI: `/prompts:to-duaiclub` 또는 "DUAI에 올려줘"

설치 위치: `~/.claude/skills/to-duaiclub`, `~/.codex/skills/to-duaiclub`, CLI는 `~/.duaiclub/duai.mjs`.
상태 점검: `node "$HOME/.duaiclub/duai.mjs" doctor`

## Claude 웹·앱

1. **설정 > 커넥터 > 커스텀 커넥터 추가**에 `https://www.duaiclub.com/mcp` 입력 후 DUAI Club 계정으로 로그인·허용
2. **설정 > 기능 > 스킬**에서 [dist/to-duaiclub.zip](dist/to-duaiclub.zip) 업로드
3. 대화에서 "/to-duaiclub" 또는 "오늘 작업 DUAI에 올려줘"

## ChatGPT 웹·앱

[docs/chatgpt.md](docs/chatgpt.md)를 참고하세요. 요약하면 커넥터에 `https://www.duaiclub.com/mcp`를 추가하고 "DUAI에 올려줘"라고 말하면 됩니다.

## 올라가는 모습

사이드 메뉴의 **활동 공유** 게시판에 새 글로 올라갑니다. 목록에는 첫 스크린샷이 썸네일로 보이고, 링크는 글의 링크 칸에 들어갑니다.
요약 3~4줄은 AI가 대화 내용과 git 커밋을 보고 직접 씁니다. 회원이 입력할 것은 없고, 올린 뒤 글에서 수정·삭제할 수 있습니다.

```
제목: Claude Code로 식단 추천 봇 만들기

- 사내 식단표를 읽어 취향에 맞는 메뉴를 추천하는 슬랙 봇을 만들었습니다
- Claude Code에게 크롤러와 추천 로직을 맡기고 프롬프트로 방향만 잡았습니다
- 식단 PDF를 표로 바꾸는 부분이 가장 까다로웠고 pdfplumber로 해결했습니다
- 다음에는 알레르기 필터를 추가해 볼 예정입니다

![메인 화면](/objects/uploads/...)
![video:데모 영상](/objects/uploads/...)

_Claude Code · /to-duaiclub 으로 업로드_
```

## 개발

- 스킬 본문: [skills/to-duaiclub/SKILL.md](skills/to-duaiclub/SKILL.md)
- CLI: [skills/to-duaiclub/scripts/duai.mjs](skills/to-duaiclub/scripts/duai.mjs) (Node 18+, 의존성 없음)
- Claude 업로드용 zip 만들기: `node scripts/package.mjs`
- 서버 API(duaiclub.com, `FlynnYoon/AI-Club-Manager`): `/api/v1/*`(Bearer 토큰), `/mcp`(OAuth 2.1)
- 다른 서버로 테스트: `DUAI_BASE_URL=http://localhost:5000 node skills/to-duaiclub/scripts/duai.mjs doctor`
