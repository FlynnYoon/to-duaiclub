#!/usr/bin/env bash
# /to-duaiclub 스킬 설치 (macOS / Linux)
#   curl -fsSL https://raw.githubusercontent.com/FlynnYoon/to-duaiclub/main/install.sh | bash
set -euo pipefail

REPO="${DUAI_SKILL_REPO:-FlynnYoon/to-duaiclub}"
REF="${DUAI_SKILL_REF:-main}"
DUAI_HOME="$HOME/.duaiclub"

say() { printf '\033[1;36m[duaiclub]\033[0m %s\n' "$*"; }
ask() { local a=""; if [ -r /dev/tty ]; then read -r -p "$1" a </dev/tty || true; fi; printf '%s' "$a"; }

command -v node >/dev/null 2>&1 || { say "Node.js 18 이상이 필요합니다: https://nodejs.org"; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || { say "Node.js 18 이상이 필요합니다 (현재 $(node -v))"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo "")"
if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/skills/to-duaiclub/SKILL.md" ]; then
  SRC="$SCRIPT_DIR/skills/to-duaiclub"
else
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  say "스킬 내려받는 중 ($REPO@$REF)"
  curl -fsSL "https://codeload.github.com/$REPO/tar.gz/$REF" | tar -xz -C "$TMP"
  SRC="$(find "$TMP" -maxdepth 3 -type d -path '*/skills/to-duaiclub' | head -n1)"
fi
[ -f "$SRC/SKILL.md" ] || { say "스킬 파일을 찾지 못했습니다"; exit 1; }

for dest in "$HOME/.claude/skills/to-duaiclub" "$HOME/.codex/skills/to-duaiclub"; do
  rm -rf "$dest"
  mkdir -p "$dest"
  cp -R "$SRC/." "$dest/"
  say "설치: $dest"
done

mkdir -p "$DUAI_HOME" "$HOME/.codex/prompts"
cp "$SRC/scripts/duai.mjs" "$DUAI_HOME/duai.mjs"
cat > "$HOME/.codex/prompts/to-duaiclub.md" <<'EOF'
to-duaiclub 스킬을 사용해 오늘 작업 결과물을 www.duaiclub.com 오늘 모임 일정에 올려줘. $ARGUMENTS
EOF
say "CLI: node \"\$HOME/.duaiclub/duai.mjs\""

if [ "$(ask '스크린샷·영상 자동 캡처용 Playwright(Chromium, 약 150MB)를 설치할까요? [Y/n] ')" != "n" ]; then
  npm i --silent --prefix "$DUAI_HOME" playwright >/dev/null
  npx --prefix "$DUAI_HOME" playwright install chromium
fi
command -v ffmpeg >/dev/null 2>&1 || say "참고: ffmpeg가 있으면 영상을 더 작게(mp4) 올립니다 (brew install ffmpeg / apt install ffmpeg)"

TOKEN="$(ask 'https://www.duaiclub.com/profile 에서 발급한 토큰을 붙여넣으세요 (나중에 하려면 Enter): ')"
if [ -n "$TOKEN" ]; then
  node "$DUAI_HOME/duai.mjs" login "$TOKEN"
else
  say "나중에: node \"\$HOME/.duaiclub/duai.mjs\" login <토큰>"
fi

say "완료! Claude Code에서는 /to-duaiclub, Codex에서는 /prompts:to-duaiclub 또는 \"DUAI에 올려줘\"라고 입력하세요."
