# /to-duaiclub 스킬 설치 (Windows PowerShell)
#   irm https://raw.githubusercontent.com/FlynnYoon/to-duaiclub/main/install.ps1 | iex
$ErrorActionPreference = "Stop"

$Repo = if ($env:DUAI_SKILL_REPO) { $env:DUAI_SKILL_REPO } else { "FlynnYoon/to-duaiclub" }
$Ref = if ($env:DUAI_SKILL_REF) { $env:DUAI_SKILL_REF } else { "main" }
$DuaiHome = Join-Path $HOME ".duaiclub"

function Say($msg) { Write-Host "[duaiclub] $msg" -ForegroundColor Cyan }

if (-not (Get-Command node -ErrorAction SilentlyContinue) -and (Get-Command winget -ErrorAction SilentlyContinue)) {
  Say "Node.js를 설치합니다 (1~2분)"
  winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements | Out-Null
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say "Node.js 18 이상이 필요합니다: https://nodejs.org 에서 설치한 뒤 다시 실행하세요"; return }
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
Set-Content -Encoding utf8 (Join-Path $HOME ".codex/prompts/to-duaiclub.md") 'to-duaiclub 스킬을 사용해 오늘 작업 결과물을 www.duaiclub.com 활동 공유 게시판에 올려줘. $ARGUMENTS'
Say 'CLI: node "$HOME/.duaiclub/duai.mjs"'

Say "스크린샷 도구 설치 중"
if (-not (Test-Path (Join-Path $DuaiHome "package.json"))) { Set-Content -Encoding utf8 (Join-Path $DuaiHome "package.json") '{"private":true}' }
npm i --silent --no-audit --no-fund --prefix $DuaiHome playwright 2>$null | Out-Null

$cfg = Join-Path $DuaiHome "config.json"
if (-not (Test-Path $cfg)) {
  Say "브라우저가 열리면 DUAI Club에 로그인하고 '허용'을 눌러주세요"
  node (Join-Path $DuaiHome "duai.mjs") login | Out-Null
}

Say '완료! Claude Code에서 작업을 마친 뒤 /to-duaiclub 이라고 입력하세요. (Codex: /prompts:to-duaiclub)'
