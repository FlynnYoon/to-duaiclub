#!/usr/bin/env bash
# /to-duaiclub 스킬 설치 (macOS / Linux)
#   curl -fsSL https://raw.githubusercontent.com/FlynnYoon/to-duaiclub/main/install.sh | bash
set -euo pipefail

REPO="${DUAI_SKILL_REPO:-FlynnYoon/to-duaiclub}"
REF="${DUAI_SKILL_REF:-main}"
DUAI_HOME="$HOME/.duaiclub"

say() { printf '\033[1;36m[duaiclub]\033[0m %s\n' "$*"; }
if ! command -v node >/dev/null 2>&1 && command -v brew >/dev/null 2>&1; then
  say "Node.js를 설치합니다 (1~2분)"
  brew install node >/dev/null
fi
command -v node >/dev/null 2>&1 || { say "Node.js 18 이상이 필요합니다: https://nodejs.org 에서 설치한 뒤 다시 실행하세요"; exit 1; }
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
to-duaiclub 스킬을 사용해 오늘 작업 결과물을 www.duaiclub.com '활동 공유' 게시판에 올려줘. $ARGUMENTS
EOF
say "CLI: node \"\$HOME/.duaiclub/duai.mjs\""

say "스크린샷 도구 설치 중"
[ -f "$DUAI_HOME/package.json" ] || echo '{"private":true}' > "$DUAI_HOME/package.json"
npm i --silent --no-audit --no-fund --prefix "$DUAI_HOME" playwright >/dev/null 2>&1 || true

if [ ! -f "$DUAI_HOME/config.json" ]; then
  say "브라우저가 열리면 DUAI Club에 로그인하고 '허용'을 눌러주세요"
  node "$DUAI_HOME/duai.mjs" login >/dev/null || true
fi

say "완료! Claude Code에서 작업을 마친 뒤 /to-duaiclub 이라고 입력하세요. (Codex: /prompts:to-duaiclub)"
