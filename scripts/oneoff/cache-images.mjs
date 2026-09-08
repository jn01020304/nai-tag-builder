// 단부루 CDN 은 클라우드플레어가 브라우저 TLS 지문을 보고 403 을 준다.
// 403 응답이 cross-origin-resource-policy: same-origin 을 달고 오기 때문에
// 브라우저는 ERR_BLOCKED_BY_RESPONSE.NotSameOrigin 으로 이미지를 통째로 막는다.
// curl 은 지문이 달라 200 이 오므로, curl 로 미리 받아 로컬에 깔아둔다.
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CDN = "https://cdn.donmai.us";
const outDir = path.resolve("resource/catalog/images");
const CONCURRENCY = 5;

const imgDir = h => h.slice(0, 2) + "/" + h.slice(2, 4);
const heroUrl = (h, kind, ext) => kind === "s"
  ? `${CDN}/sample/${imgDir(h)}/sample-${h}.${ext}`
  : `${CDN}/original/${imgDir(h)}/${h}.${ext}`;
const thumbUrl = h => `${CDN}/180x180/${imgDir(h)}/${h}.jpg`;
const midUrl = h => `${CDN}/360x360/${imgDir(h)}/${h}.jpg`;

// 목업 안의 IMAGES 리터럴이 원본이다. 별도 사본을 만들면 둘이 어긋난다.
function readImages() {
  const src = fs.readFileSync(path.resolve("mockup/shell-v18.html"), "utf8");
  const line = src.split("\n").find(l => l.startsWith("const IMAGES="));
  if (!line) throw new Error("목업에서 IMAGES 를 못 찾았다");
  return JSON.parse(line.replace(/^const IMAGES=/, "").replace(/;\s*$/, ""));
}

async function fetchTo(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 512) return "skip";
  const tmp = dest + ".part";
  for (let i = 0; i < 3; i++) {
    try {
      const { stdout } = await execFileAsync("curl", [
        "-s", "-m", "60", "--compressed", "-o", tmp, "-w", "%{http_code}", url,
      ], { maxBuffer: 1024 * 1024 });
      const status = Number(String(stdout).trim());
      if (status === 200 && fs.existsSync(tmp) && fs.statSync(tmp).size > 512) {
        fs.renameSync(tmp, dest);
        return "ok";
      }
      if (status === 404) { fs.rmSync(tmp, { force: true }); return "404"; }
      fs.rmSync(tmp, { force: true });
    } catch {
      fs.rmSync(tmp, { force: true });
    }
    await new Promise(r => setTimeout(r, 1500 * (i + 1)));
  }
  return "fail";
}

const IMAGES = readImages();
fs.mkdirSync(outDir, { recursive: true });

// 첫 장은 도감 큰 그림(원본급)과 호버 팝업 썸네일로 쓰고,
// 나머지 장은 도감 타일로만 쓰니까 360px 중간 크기면 충분하다. 원본으로 받으면 300MB 더 든다.
const jobs = [];
for (const [tag, shots] of Object.entries(IMAGES)) {
  if (!Array.isArray(shots) || !shots.length) continue;
  const [hash, kind, ext] = shots[0].split(".");
  jobs.push({ tag, url: heroUrl(hash, kind, ext), dest: path.join(outDir, `${hash}.${ext}`) });
  jobs.push({ tag, url: thumbUrl(hash), dest: path.join(outDir, `${hash}.t.jpg`) });
  for (const shot of shots) {
    const h = shot.split(".")[0];
    jobs.push({ tag, url: midUrl(h), dest: path.join(outDir, `${h}.m.jpg`) });
  }
}

console.log(`작가 ${Object.keys(IMAGES).length}명 · 받을 파일 ${jobs.length}개`);
const tally = { ok: 0, skip: 0, 404: 0, fail: 0 };
const failed = [];
let done = 0;
const started = Date.now();

async function worker(queue) {
  while (queue.length) {
    const job = queue.shift();
    const r = await fetchTo(job.url, job.dest);
    tally[r]++;
    if (r === "fail") failed.push(job.tag + " " + job.url);
    done++;
    if (done % 25 === 0 || done === jobs.length) {
      const per = (Date.now() - started) / done;
      const left = Math.round(per * (jobs.length - done) / 1000);
      process.stdout.write(`\r  ${done}/${jobs.length}  받음 ${tally.ok} 건너뜀 ${tally.skip} 없음 ${tally["404"]} 실패 ${tally.fail}  남은 ${left}초   `);
    }
  }
}

const queue = jobs.slice();
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

const bytes = fs.readdirSync(outDir).reduce((s, f) => s + fs.statSync(path.join(outDir, f)).size, 0);
console.log(`\n로컬 캐시 ${fs.readdirSync(outDir).length}개 · ${(bytes / 1048576).toFixed(1)}MB → ${outDir}`);
if (failed.length) console.log("실패:", failed.slice(0, 15).join("\n  "));
