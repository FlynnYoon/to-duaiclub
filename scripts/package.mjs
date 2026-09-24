// Claude 웹·앱 스킬 업로드용 dist/to-duaiclub.zip 생성 (zip 안의 최상위 폴더가 to-duaiclub/).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const out = path.join(dist, "to-duaiclub.zip");
fs.mkdirSync(dist, { recursive: true });
fs.rmSync(out, { force: true });

const skills = path.join(root, "skills");
const attempts =
  process.platform === "win32"
    ? [["tar", ["-a", "-c", "-f", out, "to-duaiclub"]]]
    : [["zip", ["-qr", out, "to-duaiclub"]], ["tar", ["-a", "-c", "-f", out, "to-duaiclub"]]];

for (const [cmd, args] of attempts) {
  const r = spawnSync(cmd, args, { cwd: skills, stdio: "inherit" });
  if (r.status === 0 && fs.existsSync(out)) {
    console.log(`생성: ${path.relative(root, out)} (${(fs.statSync(out).size / 1024).toFixed(1)}KB)`);
    process.exit(0);
  }
}
console.error("zip 생성 실패: zip 또는 bsdtar가 필요합니다");
process.exit(1);
