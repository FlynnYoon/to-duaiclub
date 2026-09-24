# ChatGPT에서 /to-duaiclub 쓰기

ChatGPT는 MCP 커넥터로 DUAI Club에 연결합니다. 토큰은 필요 없고, 연결할 때 DUAI Club 계정으로 로그인합니다.

## 1. 커넥터 추가 (최초 1회)

1. ChatGPT **설정 > 앱과 커넥터(Apps & Connectors) > 고급 설정**에서 **개발자 모드**를 켭니다.
   (워크스페이스 플랜이면 관리자가 커넥터 추가를 허용해야 할 수 있습니다.)
2. **커넥터 만들기(Create)**:
   - 이름: `DUAI Club`
   - MCP 서버 URL: `https://www.duaiclub.com/mcp`
   - 인증: OAuth
3. 연결하면 DUAI Club 로그인 화면이 뜹니다. 로그인하고 **허용**을 누릅니다.

## 2. 사용

작업을 마친 대화에서 커넥터를 켜고 다음처럼 말합니다.

> /to-duaiclub 오늘 작업 DUAI에 올려줘

ChatGPT가 오늘 일정을 조회하고(`get_active_event`), 결과 카드(`make_card`)나 첨부한 스크린샷(`upload_image`)을 준비한 뒤, 바로 올리고(`post_showcase`) 링크를 알려줍니다.

## 3. (선택) 프로젝트 지침으로 고정

자주 쓴다면 ChatGPT **프로젝트**를 하나 만들고 지침(Instructions)에 아래를 붙여넣으세요.

```
사용자가 "/to-duaiclub" 또는 "DUAI에 올려줘"라고 하면 DUAI Club 커넥터로 다음을 수행한다.
1) 이번 대화에서 한 일을 제목(40자 이내)과 요약으로 직접 정리 (요약은 "- "로 시작하는 3~4줄: 오늘 만든 것, 어떤 AI를 어떻게 썼는지, 핵심 내용이나 배운 점, 선택으로 다음 계획)
2) 일정은 고르지 않는다 (eventId를 비우면 서버가 오늘 일정을 고르거나 새로 만든다)
3) 대화에 첨부된 스크린샷이 있으면 upload_image, 없으면 make_card로 이미지 준비
4) 묻지 않고 post_showcase(tool: "ChatGPT")로 올리고 eventTitle과 url 알려주기
비밀정보(API 키, 사내 기밀, 개인정보)는 올리지 않는다.
```

## 제한

- 영상은 올릴 수 없습니다. 데모 영상까지 올리려면 Claude Code 또는 Codex CLI에서 스킬을 쓰세요.
- 이미지는 장당 10MB까지입니다.
