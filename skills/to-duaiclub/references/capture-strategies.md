# 결과물 유형별 캡처 전략

목표: **2분 안에** 이미지 1~3장과 15초 이하 영상 1개. 막히면 즉시 결과 카드로 대체한다.
공통 크기 기준: 스크린샷은 1280x800 JPEG(품질 80, 장당 1MB 안팎), 영상은 720p 이하·15초 이하·무음. ffmpeg가 있으면 H.264(CRF 28)로 변환해 보통 2~5MB이며, 20MB를 넘으면 960px·CRF 32로 한 번 더 줄이고 그래도 크면 영상을 뺀다.

## 1. 로컬 웹앱 (React, Vite, Next.js, Express 페이지, Streamlit 등)

```bash
duai capture web --dev                      # package.json의 dev/start 스크립트 자동 사용
duai capture web --dev "npm run dev" --port 5173 --paths "/,/dashboard"
duai capture web --dev "streamlit run app.py --server.headless true" --port 8501
```

- 이미 개발 서버가 떠 있으면 `--url http://localhost:5173` 를 쓴다(서버를 새로 띄우지 않는다).
- `--paths`에는 이번에 만든 화면을 최대 3개 넣는다. 로그인이 필요한 화면은 캡처하지 말고 공개 화면만 쓴다.
- 영상은 각 페이지를 부드럽게 스크롤하며 녹화한다. 인터랙션이 핵심이면 `--video-seconds 15`.

## 2. 배포된 웹 (Replit, Vercel, GitHub Pages 등)

```bash
duai capture web --url https://my-app.replit.app --paths "/,/about"
```

배포 URL은 링크(`--link`)에도 함께 넣는다.

## 3. CLI · 스크립트 · 봇 · 데이터 처리

```bash
duai capture terminal --cmd "python main.py --demo" --title "식단 추천 봇 실행"
duai capture terminal --file run.log --lines 30
```

- 실행 시간이 긴 명령은 피하고 데모용 짧은 입력을 쓴다(기본 60초 제한).
- 결과의 `exitCode`가 0이 아니면 오류 화면일 가능성이 높다. 이미지를 확인하고 오류라면 올리지 않는다.
- 출력에 토큰·키·개인정보가 섞이면 쓰지 않는다.

## 4. 이미지·영상 생성 작업 (이미지 생성, 영상 편집 등)

`duai context`의 `recentMedia`에 있는 결과 파일을 그대로 `--media`로 올린다. 20MB를 넘는 영상은 ffmpeg로 줄인다:

```bash
ffmpeg -y -i in.mov -t 15 -vf "scale='min(1280,iw)':-2" -c:v libx264 -crf 28 -preset veryfast -pix_fmt yuv420p -an -movflags +faststart out.mp4
```

## 5. 문서 · 프롬프트 · 학습 정리 · 캡처 실패

```bash
duai card --title "프롬프트 엔지니어링 스터디" --summary "..." --tags "Claude,프롬프트"
```

출력된 `objectPath`를 `post --objects`로 넘긴다. 서버에서 1200x630 카드 이미지를 만든다.

## 판단 순서

1. 대화에서 만든 것이 화면이 있는 앱인가? → 1 또는 2
2. 실행 결과가 텍스트인가? → 3
3. 결과물 자체가 이미지·영상인가? → 4
4. 그 밖 또는 위 단계가 한 번 실패 → 5
