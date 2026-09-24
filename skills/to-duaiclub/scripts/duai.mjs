#!/usr/bin/env node
// DUAI Club /to-duaiclub CLI. Node 18+, 외부 의존성 없음 (Playwright·ffmpeg는 있으면 사용).
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HOME_DIR = path.join(os.homedir(), ".duaiclub");
const CONFIG_PATH = path.join(HOME_DIR, "config.json");
const DEFAULT_BASE = "https://www.duaiclub.com";
const TARGET_FILE_BYTES = 20 * 1024 * 1024;
const SERVER_MAX_BYTES = 50 * 1024 * 1024;
const CONTENT_TYPES = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".mp4": "video/mp4", ".webm": "video/webm",
};

// ---------- 공통 ----------

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const eq = a.indexOf("=");
    const key = eq > 0 ? a.slice(2, eq) : a.slice(2);
    let val = eq > 0 ? a.slice(eq + 1) : argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    if (key in out) out[key] = [].concat(out[key], val);
    else out[key] = val;
  }
  return out;
}

const list = (v) => [].concat(v ?? []).flatMap((x) => String(x).split(",")).map((s) => s.trim()).filter(Boolean);
const print = (obj) => console.log(JSON.stringify(obj, null, 2));
function die(message, extra = {}) {
  console.error(JSON.stringify({ ok: false, error: message, ...extra }, null, 2));
  process.exit(1);
}
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)}MB`;

function loadConfig() {
  let file = {};
  try { file = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); } catch {}
  return {
    baseUrl: (process.env.DUAI_BASE_URL || file.baseUrl || DEFAULT_BASE).replace(/\/+$/, ""),
    token: process.env.DUAI_TOKEN || file.token || null,
  };
}

function saveConfig(cfg) {
  fs.mkdirSync(HOME_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

const note = (msg) => console.error(`[duaiclub] ${msg}`);

function openBrowser(url) {
  if (process.env.DUAI_NO_BROWSER) return;
  const [cmd, argv] = process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
    : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try { spawn(cmd, argv, { stdio: "ignore", detached: true }).unref(); } catch {}
}

const b64url = (buf) => buf.toString("base64url");

// 브라우저로 DUAI Club에 로그인해 토큰을 받아 저장한다 (OAuth + PKCE, 127.0.0.1 콜백).
async function browserLogin(baseUrl) {
  const { createServer } = await import("node:http");
  const crypto = await import("node:crypto");
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));

  let finish;
  const done = new Promise((resolve) => { finish = resolve; });
  const server = createServer((req, res) => {
    const u = new URL(req.url, "http://127.0.0.1");
    if (u.pathname !== "/callback") { res.writeHead(404).end(); return; }
    const ok = u.searchParams.get("state") === state && u.searchParams.get("code");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", Connection: "close" });
    res.end(`<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;text-align:center;padding:60px">
<h2>${ok ? "DUAI Club 연결 완료" : "연결하지 못했습니다"}</h2><p>${ok ? "이 창을 닫고 터미널로 돌아가세요." : "터미널에서 다시 시도해 주세요."}</p></body>`);
    finish(ok ? { code: u.searchParams.get("code") } : { error: u.searchParams.get("error") || "state 불일치" });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
  try {
    const reg = await fetch(`${baseUrl}/oauth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: `DUAI 스킬 (${os.hostname()})`, redirect_uris: [redirectUri], token_endpoint_auth_method: "none" }),
    });
    if (!reg.ok) die(`로그인 준비 실패 (${reg.status})`, { needsLogin: true });
    const { client_id } = await reg.json();
    const authUrl = `${baseUrl}/oauth/authorize?` + new URLSearchParams({
      response_type: "code", client_id, redirect_uri: redirectUri, code_challenge: challenge, code_challenge_method: "S256", state,
    });
    note("브라우저에서 DUAI Club에 로그인하고 '허용'을 눌러주세요 (처음 한 번만).");
    note(`브라우저가 안 열리면 이 주소를 여세요: ${authUrl}`);
    openBrowser(authUrl);
    let timeoutId;
    const timer = new Promise((r) => { timeoutId = setTimeout(() => r({ error: "5분 안에 로그인하지 않았습니다" }), 5 * 60 * 1000); });
    const result = await Promise.race([done, timer]);
    clearTimeout(timeoutId);
    if (result.error) die(`로그인하지 못했습니다: ${result.error}`, { needsLogin: true });
    const tok = await fetch(`${baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code: result.code, code_verifier: verifier, client_id, redirect_uri: redirectUri }),
    });
    const data = await tok.json().catch(() => ({}));
    if (!tok.ok || !data.access_token) die(`로그인하지 못했습니다: ${data.error_description || tok.status}`, { needsLogin: true });
    saveConfig({ baseUrl, token: data.access_token });
    note("로그인 완료.");
    return { baseUrl, token: data.access_token };
  } finally {
    server.close();
    server.closeAllConnections?.();
  }
}

async function api(method, pathname, body, cfg = loadConfig(), retried = false) {
  if (!cfg.token) cfg = await browserLogin(cfg.baseUrl);
  const res = await fetch(cfg.baseUrl + pathname, {
    method,
    headers: { Authorization: `Bearer ${cfg.token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }
  if (res.status === 401) {
    if (retried || process.env.DUAI_TOKEN) die("로그인이 만료되었습니다. `duai login`을 다시 실행하세요", { needsLogin: true });
    note("로그인이 만료되어 다시 로그인합니다.");
    return api(method, pathname, body, await browserLogin(cfg.baseUrl), true);
  }
  if (!res.ok) die(data.error || `요청 실패 (${res.status})`, { status: res.status });
  return data;
}

function has(cmd) {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { stdio: "ignore" });
  return r.status === 0;
}

function sh(cmd, opts = {}) {
  const r = spawnSync(cmd, { shell: true, encoding: "utf8", timeout: opts.timeout ?? 20000, cwd: opts.cwd, maxBuffer: 10 * 1024 * 1024 });
  return { code: r.status, out: (r.stdout || "") + (opts.stderr ? r.stderr || "" : ""), err: r.stderr || "" };
}

let playwrightDir = null;

async function loadPlaywright() {
  const bases = [path.join(process.cwd(), "noop.js"), path.join(HOME_DIR, "noop.js")];
  for (const base of bases) {
    try {
      const resolved = createRequire(base).resolve("playwright");
      const mod = await import(pathToFileURL(resolved).href);
      playwrightDir = path.dirname(resolved);
      return mod.chromium ? mod : mod.default;
    } catch {}
  }
  return null;
}

async function ensurePlaywright() {
  const pw = await loadPlaywright();
  if (pw || !has("npm")) return pw;
  note("스크린샷 도구를 처음 한 번 설치합니다 (1분 정도)...");
  fs.mkdirSync(HOME_DIR, { recursive: true });
  const pkg = path.join(HOME_DIR, "package.json");
  if (!fs.existsSync(pkg)) fs.writeFileSync(pkg, JSON.stringify({ private: true }));
  sh(`npm i --silent --no-audit --no-fund --prefix "${HOME_DIR}" playwright`, { timeout: 240000 });
  return loadPlaywright();
}

async function launchBrowser(pw) {
  for (const opts of [{}, { channel: "chrome" }, { channel: "msedge" }]) {
    try { return await pw.chromium.launch(opts); } catch {}
  }
  const cli = playwrightDir && path.join(playwrightDir, "cli.js");
  if (cli && fs.existsSync(cli)) {
    note("브라우저 엔진을 처음 한 번 내려받습니다 (1~2분)...");
    sh(`"${process.execPath}" "${cli}" install chromium`, { timeout: 300000 });
    try { return await pw.chromium.launch(); } catch {}
  }
  die("캡처용 브라우저를 실행하지 못했습니다. `duai card`로 결과 카드를 대신 쓰세요", { needsPlaywright: true });
}

function outDir(args) {
  const dir = path.resolve(args.out || path.join(os.tmpdir(), "duaiclub", new Date().toISOString().replace(/[:.]/g, "-")));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------- 명령 ----------

async function cmdLogin(args) {
  const token = args._[1] || args.token;
  const baseUrl = (args.base || loadConfig().baseUrl).replace(/\/+$/, "");
  if (token && !String(token).startsWith("duai_")) die("토큰은 duai_ 로 시작해야 합니다. 토큰 없이 `duai login`만 실행하면 브라우저로 로그인합니다");
  const cfg = token ? { baseUrl, token } : await browserLogin(baseUrl);
  const me = await api("GET", "/api/v1/me", null, cfg, true);
  saveConfig(cfg);
  print({ ok: true, user: { name: me.name, email: me.email }, config: CONFIG_PATH });
}

async function cmdWhoami() {
  const me = await api("GET", "/api/v1/me");
  print({ ok: true, name: me.name, email: me.email });
}

async function cmdDoctor() {
  const cfg = loadConfig();
  const pw = await loadPlaywright();
  let browser = false;
  if (pw) {
    try { browser = fs.existsSync(pw.chromium.executablePath()); } catch {}
  }
  const result = {
    node: process.version,
    nodeOk: Number(process.versions.node.split(".")[0]) >= 18,
    baseUrl: cfg.baseUrl,
    hasToken: !!cfg.token,
    playwright: !!pw,
    chromium: browser,
    ffmpeg: has("ffmpeg"),
    git: has("git"),
  };
  if (cfg.token) {
    try {
      const res = await fetch(cfg.baseUrl + "/api/v1/me", { headers: { Authorization: `Bearer ${cfg.token}` } });
      result.tokenValid = res.ok;
    } catch (e) {
      result.tokenValid = false;
      result.network = String(e.message || e);
    }
  }
  result.hints = [];
  if (!result.hasToken || result.tokenValid === false) result.hints.push("로그인 전입니다. 처음 올릴 때 브라우저가 열리면 DUAI Club에 로그인하고 '허용'을 누르면 됩니다");
  if (!result.playwright) result.hints.push("스크린샷 도구는 처음 캡처할 때 자동으로 설치됩니다 (npm 필요)");
  if (!result.ffmpeg) result.hints.push("ffmpeg가 없으면 영상은 webm 그대로 올립니다 (선택 설치)");
  print(result);
}

async function cmdEvent() {
  const events = await api("GET", "/api/v1/events/active");
  print({ ok: true, events: events.map((e) => ({ id: e.id, title: e.title, startDate: e.startDate, endDate: e.endDate, location: e.location })) });
}

function detectProject(root) {
  const info = { type: "unknown", devCommand: null, framework: null };
  const pkgPath = path.join(root, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const fw = ["next", "vite", "react-scripts", "nuxt", "@sveltejs/kit", "astro", "@angular/core", "express", "vue", "react"].find((d) => deps?.[d]);
      info.framework = fw || null;
      const scripts = pkg.scripts || {};
      const devKey = ["dev", "start", "serve", "preview"].find((k) => scripts[k]);
      if (devKey) info.devCommand = `npm run ${devKey}`;
      info.type = fw && fw !== "express" ? "web" : pkg.bin ? "cli" : devKey ? "web" : "node";
    } catch {}
  } else if (["index.html", "public/index.html"].some((f) => fs.existsSync(path.join(root, f)))) {
    info.type = "static-web";
  } else if (["pyproject.toml", "requirements.txt"].some((f) => fs.existsSync(path.join(root, f)))) {
    const hasStreamlit = sh("git grep -l -i streamlit -- '*.py' '*.txt' '*.toml'", { cwd: root }).out.trim();
    info.type = hasStreamlit ? "web" : "python";
    if (hasStreamlit) info.framework = "streamlit";
  }
  return info;
}

async function cmdContext() {
  const cwd = process.cwd();
  const root = sh("git rev-parse --show-toplevel", { cwd }).out.trim() || cwd;
  const isGit = sh("git rev-parse --is-inside-work-tree", { cwd }).out.trim() === "true";
  const ctx = { cwd, root, isGit, project: detectProject(root) };
  if (isGit) {
    ctx.branch = sh("git branch --show-current", { cwd }).out.trim();
    ctx.remote = sh("git remote get-url origin", { cwd }).out.trim().replace(/\/\/[^@/]+@/, "//") || null;
    ctx.status = sh("git status --short", { cwd }).out.split("\n").filter(Boolean).slice(0, 40);
    ctx.diffStat = sh("git diff --stat HEAD", { cwd }).out.trim().split("\n").filter(Boolean).slice(-15);
    ctx.todayCommits = sh('git log --since=midnight --pretty=format:"%h %s"', { cwd }).out.split("\n").filter(Boolean).slice(0, 20);
  } else {
    const since = Date.now() - 3 * 60 * 60 * 1000;
    const recent = [];
    const walk = (dir, depth) => {
      if (depth > 3 || recent.length > 40) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith(".") || e.name === "node_modules") continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, depth + 1);
        else if (fs.statSync(p).mtimeMs > since) recent.push(path.relative(root, p));
      }
    };
    try { walk(root, 0); } catch {}
    ctx.recentFiles = recent;
  }
  const media = [];
  const SKIP_DIRS = new Set(["node_modules", "dist", "build", "out", "coverage", "public", "static", "assets", "__pycache__", "venv"]);
  const walkMedia = (dir, depth) => {
    if (depth > 2) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walkMedia(p, depth + 1); continue; }
      if (!CONTENT_TYPES[path.extname(e.name).toLowerCase()] || /^(favicon|logo|icon)/i.test(e.name)) continue;
      const st = fs.statSync(p);
      if (st.mtimeMs > Date.now() - 6 * 60 * 60 * 1000 && st.size > 10 * 1024) media.push(path.relative(root, p));
    }
  };
  walkMedia(root, 0);
  ctx.recentMedia = media.slice(0, 20);
  print(ctx);
}

// ---------- 캡처 ----------

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
}

async function waitForUrl(url, timeoutMs) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const r = await fetch(url, { redirect: "manual" });
      if (r.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function startDevServer(command, port) {
  const env = { ...process.env, BROWSER: "none" };
  if (port) env.PORT = String(port);
  const child = spawn(command, { shell: true, cwd: process.cwd(), detached: process.platform !== "win32", env });
  let found = port ? `http://localhost:${port}` : null;
  const onData = (buf) => {
    if (found) return;
    const m = /(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):\d+)/.exec(buf.toString().replace(/\x1b\[[0-9;]*m/g, ""));
    if (m) found = m[1].replace("0.0.0.0", "localhost");
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  const until = Date.now() + 90000;
  while (!found && Date.now() < until && child.exitCode === null) await new Promise((r) => setTimeout(r, 500));
  if (!found) { killTree(child); die("개발 서버 주소를 찾지 못했습니다. --url 또는 --port를 지정하세요"); }
  if (!(await waitForUrl(found, 60000))) { killTree(child); die(`개발 서버(${found})가 응답하지 않습니다`); }
  return { child, url: found };
}

async function smoothScroll(page, ms) {
  const steps = Math.max(1, Math.floor(ms / 100));
  const height = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = height * (t < 0.5 ? t * 2 : 2 - t * 2);
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(100);
  }
}

function encodeVideo(input, dir) {
  if (!has("ffmpeg")) return input;
  const attempts = [{ w: 1280, crf: 28 }, { w: 960, crf: 32 }];
  for (const a of attempts) {
    const out = path.join(dir, `demo-${a.w}.mp4`);
    const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", input, "-t", "15", "-vf", `scale='min(${a.w},iw)':-2`, "-c:v", "libx264", "-preset", "veryfast", "-crf", String(a.crf), "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", out], { stdio: "ignore" });
    if (r.status === 0 && fs.existsSync(out) && fs.statSync(out).size <= TARGET_FILE_BYTES) return out;
  }
  return input;
}

async function cmdCaptureWeb(args) {
  const pw = await ensurePlaywright();
  if (!pw) die("스크린샷 도구를 설치하지 못했습니다. `duai card`로 결과 카드를 대신 쓰세요", { needsPlaywright: true });
  const dir = outDir(args);
  let server = null;
  let base = args.url;
  if (!base) {
    const cmd = args.dev === true ? detectProject(process.cwd()).devCommand : args.dev;
    if (!cmd) die("--url 또는 --dev \"npm run dev\" 가 필요합니다");
    server = await startDevServer(cmd, args.port);
    base = server.url;
  }
  const paths = list(args.paths || "/");
  const videoSeconds = Math.min(15, Number(args["video-seconds"] || 12));
  const files = [];
  const failed = [];
  const okPaths = [];
  const browser = await launchBrowser(pw);
  try {
    const shotCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: "ko-KR" });
    const page = await shotCtx.newPage();
    for (const [i, p] of paths.slice(0, 3).entries()) {
      const url = new URL(p, base).toString();
      let res = null;
      try {
        res = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      } catch (e) {
        if (!/Timeout/i.test(e.message)) {
          failed.push({ path: p, error: e.message.split("\n")[0] });
          continue;
        }
      }
      if (res && res.status() >= 400) {
        failed.push({ path: p, error: `HTTP ${res.status()}` });
        continue;
      }
      okPaths.push(p);
      await page.waitForTimeout(800);
      const file = path.join(dir, `shot-${i + 1}.jpg`);
      await page.screenshot({ path: file, type: "jpeg", quality: 80 });
      files.push({ path: file, kind: "image", caption: p === "/" ? "메인 화면" : `${p} 화면` });
    }
    await shotCtx.close();

    if (args["no-video"] !== true && videoSeconds > 0 && okPaths.length > 0) {
      const vidCtx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir, size: { width: 1280, height: 720 } }, locale: "ko-KR" });
      const vp = await vidCtx.newPage();
      const per = (videoSeconds * 1000) / okPaths.length;
      for (const p of okPaths) {
        await vp.goto(new URL(p, base).toString(), { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
        await vp.waitForTimeout(600);
        await smoothScroll(vp, Math.max(1000, per - 600));
      }
      const video = vp.video();
      await vidCtx.close();
      let raw = video ? await video.path() : null;
      if (raw && fs.existsSync(raw)) {
        const named = path.join(dir, "demo.webm");
        fs.renameSync(raw, named);
        raw = named;
        const finalPath = encodeVideo(raw, dir);
        if (fs.statSync(finalPath).size <= TARGET_FILE_BYTES) files.push({ path: finalPath, kind: "video", caption: "데모 영상" });
      }
    }
  } finally {
    await browser.close();
    if (server) killTree(server.child);
  }
  if (files.length === 0) die(`${base} 에 접속하지 못했습니다. 주소와 서버 실행 여부를 확인하거나 capture terminal / card 를 쓰세요`, { failed });
  print({ ok: true, base, dir, files: files.map((f) => ({ ...f, size: mb(fs.statSync(f.path).size) })), ...(failed.length ? { failed } : {}) });
}

const ansi = /\x1b\[[0-9;?]*[A-Za-z]/g;
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

async function cmdCaptureTerminal(args) {
  const pw = await ensurePlaywright();
  if (!pw) die("스크린샷 도구를 설치하지 못했습니다. `duai card`로 결과 카드를 대신 쓰세요", { needsPlaywright: true });
  let output = "";
  let exitCode = 0;
  let title = args.title || "";
  if (args.file) output = fs.readFileSync(args.file, "utf8");
  else if (args.cmd) {
    const r = sh(args.cmd, { timeout: Number(args.timeout || 60000), stderr: true });
    output = r.out;
    exitCode = r.code ?? 1;
    title = title || `$ ${args.cmd}`;
  } else die("--cmd \"명령\" 또는 --file 로그파일 이 필요합니다");
  const lines = output.replace(ansi, "").replace(/\r/g, "").split("\n");
  const shown = lines.slice(-Number(args.lines || 40)).join("\n");
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0b1020">
<div id="t" style="width:1100px;margin:24px;border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.5);font-family:'Cascadia Code','D2Coding','Menlo','Consolas',monospace">
<div style="background:#1f2937;padding:10px 14px;display:flex;gap:8px;align-items:center"><span style="width:12px;height:12px;border-radius:50%;background:#ef4444"></span><span style="width:12px;height:12px;border-radius:50%;background:#f59e0b"></span><span style="width:12px;height:12px;border-radius:50%;background:#10b981"></span><span style="color:#9ca3af;font-size:13px;margin-left:8px">${esc(title)}</span></div>
<pre style="margin:0;padding:18px;background:#111827;color:#e5e7eb;font-size:15px;line-height:1.5;white-space:pre-wrap;word-break:break-all">${esc(shown)}</pre></div></body>`;
  const dir = outDir(args);
  const file = path.join(dir, "terminal.png");
  const browser = await launchBrowser(pw);
  try {
    const page = await browser.newPage({ viewport: { width: 1148, height: 800 } });
    await page.setContent(html);
    await page.locator("#t").screenshot({ path: file });
  } finally {
    await browser.close();
  }
  print({
    ok: true,
    exitCode,
    ...(exitCode !== 0 ? { warning: "명령이 실패했습니다. 이미지를 열어 보고 오류 화면이면 올리지 말고 명령을 고치거나 결과 카드를 쓰세요" } : {}),
    files: [{ path: file, kind: "image", caption: "실행 결과", size: mb(fs.statSync(file).size) }],
  });
}

async function cmdCard(args) {
  if (!args.title || !args.summary) die("사용법: duai card --title \"제목\" --summary \"요약\" [--tags a,b]");
  const summary = args["summary-file"] ? fs.readFileSync(args["summary-file"], "utf8") : String(args.summary);
  const res = await api("POST", "/api/v1/card", { title: String(args.title), summary: summary.slice(0, 600), tags: list(args.tags).slice(0, 6) });
  print({ ok: true, objectPath: res.objectPath });
}

// ---------- 업로드 ----------

async function uploadFile(file) {
  const ext = path.extname(file).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) die(`지원하지 않는 형식입니다: ${file} (png, jpg, webp, gif, mp4, webm)`);
  const size = fs.statSync(file).size;
  if (size > SERVER_MAX_BYTES) die(`파일이 너무 큽니다 (${mb(size)}): ${file}. 50MB 이하로 줄여주세요`);
  const { uploadURL, objectPath } = await api("POST", "/api/v1/uploads", { name: path.basename(file), size, contentType });
  const put = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: fs.readFileSync(file) });
  if (!put.ok) die(`저장소 업로드 실패 (${put.status}): ${file}`);
  return objectPath;
}

async function cmdPost(args) {
  const title = args.title && String(args.title);
  let summary = args.summary && String(args.summary);
  if (args["summary-file"]) summary = fs.readFileSync(args["summary-file"], "utf8");
  if (!title || !summary) die("사용법: duai post --title \"제목\" --summary \"요약\" [--media a.jpg,b.mp4] [--captions \"설명1|설명2\"] [--objects /objects/..] [--link URL] [--event ID] [--tool \"Claude Code\"]");
  const files = list(args.media);
  const captions = args.captions ? String(args.captions).split("|").map((s) => s.trim()) : [];
  for (const f of files) if (!fs.existsSync(f)) die(`파일이 없습니다: ${f}`);

  const media = [];
  for (const obj of list(args.objects)) media.push({ objectPath: obj, kind: "image" });
  if (args["dry-run"]) {
    print({ ok: true, dryRun: true, title, summary, files, objects: media, links: list(args.link), event: args.event || "(자동 선택)" });
    return;
  }
  for (const [i, f] of files.entries()) {
    const kind = CONTENT_TYPES[path.extname(f).toLowerCase()]?.startsWith("video/") ? "video" : "image";
    const objectPath = await uploadFile(f);
    media.push({ objectPath, kind, ...(captions[i] ? { caption: captions[i] } : {}) });
  }
  const result = await api("POST", "/api/v1/showcase", {
    ...(args.event ? { eventId: String(args.event) } : {}),
    title,
    summary,
    media,
    links: list(args.link),
    ...(args.tool ? { tool: String(args.tool) } : {}),
  });
  print({ ok: true, ...result, uploaded: media.length });
}

const HELP = `DUAI Club /to-duaiclub CLI

  duai login                           브라우저로 DUAI Club 로그인 (다른 명령도 필요하면 자동으로 실행)
  duai login <토큰>                    프로필에서 발급한 토큰으로 로그인
  duai doctor                          설치 상태 점검
  duai context                         현재 작업(git, 프로젝트 종류, 최근 미디어) 요약
  duai event                           오늘 올라갈 모임 일정
  duai capture web --url URL | --dev ["npm run dev"] [--port N] [--paths /,/about] [--video-seconds 12] [--no-video]
  duai capture terminal --cmd "명령" | --file 로그 [--title 제목]
  duai card --title 제목 --summary 요약 [--tags a,b]     서버에서 결과 카드 생성 (objectPath 출력)
  duai post --title 제목 --summary 요약 [--media a.jpg,b.mp4] [--captions "a|b"] [--objects /objects/..]
            [--link URL] [--event ID] [--tool "Claude Code"] [--dry-run]
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [cmd, sub] = args._;
  switch (cmd) {
    case "login": return cmdLogin(args);
    case "whoami": return cmdWhoami();
    case "doctor": return cmdDoctor();
    case "context": return cmdContext();
    case "event": return cmdEvent();
    case "card": return cmdCard(args);
    case "post": return cmdPost(args);
    case "capture":
      if (sub === "web") return cmdCaptureWeb(args);
      if (sub === "terminal") return cmdCaptureTerminal(args);
      return die("capture web | capture terminal 중 하나를 지정하세요");
    default:
      console.log(HELP);
  }
}

main().catch((e) => die(String(e?.message || e)));
