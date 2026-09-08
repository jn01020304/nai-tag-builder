// 작가별 대표 이미지 URL 을 모은다. 그림 자체는 받지 않는다 —
// 실행 중에 cdn.donmai.us 에서 불러오면 되므로 배포물에는 URL 만 실린다.
//   node scripts/oneoff/collect-images.mjs          이어서 수집
//   node scripts/oneoff/collect-images.mjs --check  연결만 확인

import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const dir = path.resolve("exports/artist-mining");
const outPath = path.join(dir, "images.json");
const API = "https://danbooru.donmai.us";
const PER_ARTIST = 4;
const RATE_MS = 1000;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const load = (p, fallback) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : fallback;

// node fetch 는 Cloudflare 에 TLS 지문으로 걸린다. curl 로 나간다
async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const { stdout } = await execFileAsync("curl", [
        "-s", "-m", "40", "--compressed", "-w", "\n%{http_code}", url,
      ], { maxBuffer: 32 * 1024 * 1024 });
      const cut = stdout.lastIndexOf("\n");
      const status = Number(stdout.slice(cut + 1).trim());
      if (status === 429 || status === 503) { await sleep(5000 * (i + 1)); continue; }
      if (status !== 200) throw new Error("HTTP " + status);
      return JSON.parse(stdout.slice(0, cut));
    } catch (err) {
      if (i === tries - 1) throw err;
      await sleep(2000 * (i + 1));
    }
  }
  throw new Error("재시도 소진");
}

if (process.argv.includes("--check")) {
  try { await get(`${API}/posts.json?tags=lack&limit=1&only=id`); console.log("연결 OK"); }
  catch (e) { console.error("못 붙는다:", e.message); process.exit(1); }
  process.exit(0);
}

const catalog = load(path.join(dir, "catalog.json"), null);
if (!catalog) { console.error("catalog.json 이 없다"); process.exit(1); }
const out = load(outPath, {});
const todo = catalog.filter(r => !out[r.tag] || out[r.tag].error);
console.log("작가", catalog.length, "명 중", todo.length, "명 남음");

const started = Date.now();
for (let i = 0; i < todo.length; i++) {
  const { tag } = todo[i];
  // 점수 높은 순 = 그 작가를 가장 잘 보여주는 그림일 가능성이 높다
  const url = `${API}/posts.json?tags=${encodeURIComponent(tag)}+order%3Ascore`
    + `&limit=${PER_ARTIST}&only=id,score,image_width,image_height,preview_file_url,large_file_url,file_ext,is_banned`;
  let posts;
  try { posts = await get(url); }
  catch (err) { out[tag] = { error: String(err.message || err) }; fs.writeFileSync(outPath, JSON.stringify(out)); continue; }

  out[tag] = posts
    .filter(p => !p.is_banned && p.large_file_url)
    .map(p => ({
      id: p.id, score: p.score,
      thumb: p.preview_file_url || null,
      full: p.large_file_url,
      w: p.image_width, h: p.image_height,
    }));
  fs.writeFileSync(outPath, JSON.stringify(out));

  const done = i + 1, per = (Date.now() - started) / done;
  const left = Math.round(per * (todo.length - done) / 60000);
  process.stdout.write(`\r  ${done}/${todo.length}  ${tag.padEnd(30).slice(0, 30)} 남은 ${left}분   `);
  await sleep(RATE_MS);
}

const filled = Object.values(out).filter(v => Array.isArray(v) && v.length).length;
const empty = Object.entries(out).filter(([, v]) => Array.isArray(v) && !v.length).map(([k]) => k);
const failed = Object.entries(out).filter(([, v]) => v && v.error).map(([k]) => k);
console.log("\n이미지 있는 작가", filled, "/ 빈 작가", empty.length, "/ 실패", failed.length);
if (empty.length) console.log("빈 작가:", empty.slice(0, 20).join(", "));
if (failed.length) console.log("실패:", failed.join(", "));
console.log("→", outPath, (fs.statSync(outPath).size / 1024).toFixed(0) + "KB");
