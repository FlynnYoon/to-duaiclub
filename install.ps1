# /to-duaiclub 스킬 설치 (Windows PowerShell)
#   irm https://raw.githubusercontent.com/FlynnYoon/to-duaiclub/main/install.ps1 | iex
$ErrorActionPreference = "Stop"

$Repo = if ($env:DUAI_SKILL_REPO) { $env:DUAI_SKILL_REPO } else { "FlynnYoon/to-duaiclub" }
$Ref = if ($env:DUAI_SKILL_REF) { $env:DUAI_SKILL_REF } else { "main" }
$DuaiHome = Join-Path $HOME ".duaiclub"

function Say($msg) { Write-Host "[duaiclub] $msg" -ForegroundColor Cyan }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say "Node.js 18 이상이 필요합니다: https://nodejs.org"; return }
$major = [int](node -p "process.versions.node.split('.')[0]")
if ($major -lt 18) { Say "Node.js 18 이상이 필요합니다 (현재 $(node -v))"; return }

$src = $null
if ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot "skills/to-duaiclub/SKILL.md"))) {
  $src = Join-Path $PSScriptRoot "skills/to-duaiclub"
} else {
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ("duaiclub-" + [guid]::NewGuid())
  New-Item -ItemType Directory -Force $tmp | Out-Null
  Say "스킬 내려받는 중 ($Repo@$Ref)"
  $zip = Join-Path $tmp "skill.zip"
  Invoke-WebRequest -UseBasicParsing "https://codeload.github.com/$Repo/zip/$Ref" -OutFile $zip
  Expand-Archive $zip -DestinationPath $tmp -Force
  $src = Get-ChildItem $tmp -Recurse -Directory | Where-Object { $_.FullName -match '[\\/]skills[\\/]to-duaiclub$' } | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $src -or -not (Test-Path (Join-Path $src "SKILL.md"))) { Say "스킬 파일을 찾지 못했습니다"; return }

foreach ($dest in @((Join-Path $HOME ".claude/skills/to-duaiclub"), (Join-Path $HOME ".codex/skills/to-duaiclub"))) {
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  New-Item -ItemType Directory -Force $dest | Out-Null
  Copy-Item (Join-Path $src "*") $dest -Recurse -Force
  Say "설치: $dest"
}

New-Item -ItemType Directory -Force $DuaiHome, (Join-Path $HOME ".codex/prompts") | Out-Null
Copy-Item (Join-Path $src "scripts/duai.mjs") (Join-Path $DuaiHome "duai.mjs") -Force
Set-Content -Encoding utf8 (Join-Path $HOME ".codex/prompts/to-duaiclub.md") 'to-duaiclub 스킬을 사용해 오늘 작업 결과물을 www.duaiclub.com 오늘 모임 일정에 올려줘. $ARGUMENTS'
Say 'CLI: node "$HOME/.duaiclub/duai.mjs"'

$pw = Read-Host "스크린샷·영상 자동 캡처용 Playwright(Chromium, 약 150MB)를 설치할까요? [Y/n]"
if ($pw -ne "n") {
  npm i --silent --prefix $DuaiHome playwright | Out-Null
  npx --prefix $DuaiHome playwright install chromium
}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { Say "참고: ffmpeg가 있으면 영상을 더 작게(mp4) 올립니다 (winget install ffmpeg)" }

$token = Read-Host "https://www.duaiclub.com/profile 에서 발급한 토큰을 붙여넣으세요 (나중에 하려면 Enter)"
if ($token) {
  node (Join-Path $DuaiHome "duai.mjs") login $token
} else {
  Say '나중에: node "$HOME/.duaiclub/duai.mjs" login <토큰>'
}

Say '완료! Claude Code에서는 /to-duaiclub, Codex에서는 /prompts:to-duaiclub 또는 "DUAI에 올려줘"라고 입력하세요.'
