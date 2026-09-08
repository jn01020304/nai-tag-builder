// 작가별 Score 수집. VPN 켜고 제연 PC 에서 돌린다.
//   node scripts/oneoff/collect-scores.mjs          전체
//   node scripts/oneoff/collect-scores.mjs --check  연결만 확인
//
// 중간에 끊겨도 다시 돌리면 남은 것부터 간다. 7시간짜리를 노트북에서 돌리는 일이므로
// 진행 상황을 매 응답마다 파일에 찍는다.

import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const API = "https://danbooru.donmai.us";
const dir = path.resolve("exports/artist-mining");
const outPath = path.join(dir, "scores.json");
const basePath = path.join(dir, "period-baselines.json");
const RATE_MS = 1000;        // 초당 1회. 올리지 말 것 — 먼저 막히는 건 우리다
const SAMPLE = 200;          // 100~200장 구간은 이 한 번이 사실상 전수다

const sleep = ms => new Promise(r => setTimeout(r, ms));
const load = (p, fallback) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : fallback;

// node 의 fetch 는 Cloudflare 에 TLS 지문으로 걸려 403 을 맞는다. curl 은 통과한다.
// VPN 을 켜도 이건 그대로이므로 요청은 전부 curl 로 나간다.
async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const { stdout } = await execFileAsync("curl", [
        "-s", "-m", "40", "--compressed",
        "-w", "\n%{http_code}", url,
      ], { maxBuffer: 32 * 1024 * 1024 });
      const cut = stdout.lastIndexOf("\n");
      const status = Number(stdout.slice(cut + 1).trim());
      const body = stdout.slice(0, cut);
      if (status === 429 || status === 503) { await sleep(5000 * (i + 1)); continue; }
      if (status !== 200) throw new Error("HTTP " + status);
      return JSON.parse(body);
    } catch (err) {
      if (i === tries - 1) throw err;
      await sleep(2000 * (i + 1));
    }
  }
  throw new Error("재시도 소진");
}

// 0 과 음수가 섞이므로 그대로 곱하면 무너진다. +1 을 밀어 로그를 취한다
function geometricMean(scores) {
  const valid = scores.filter(s => Number.isFinite(s));
  if (!valid.length) return null;
  const shifted = valid.map(s => Math.max(0, s) + 1);
  const logSum = shifted.reduce((sum, v) => sum + Math.log(v), 0);
  return Math.exp(logSum / shifted.length) - 1;
}

const quarters = [];
for (let y = 2005; y <= new Date().getFullYear(); y++)
  for (const [a, b] of [["01-01", "03-31"], ["04-01", "06-30"], ["07-01", "09-30"], ["10-01", "12-31"]]) {
    const from = y + "-" + a, to = y + "-" + b;
    if (new Date(from) <= new Date()) quarters.push({ key: y + a.slice(0, 2), from, to });
  }

async function collectBaselines() {
  const done = load(basePath, {});
  const todo = quarters.filter(q => done[q.key] == null);
  if (!todo.length) { console.log("기준값 이미 완료", Object.keys(done).length, "분기"); return done; }
  console.log("분기 기준값", todo.length, "개 남음");
  for (const q of todo) {
    const url = `${API}/posts.json?tags=date%3A${q.from}..${q.to}+order%3Arandom&limit=${SAMPLE}&only=score`;
    const posts = await get(url);
    done[q.key] = { n: posts.length, gm: geometricMean(posts.map(p => p.score)) };
    fs.writeFileSync(basePath, JSON.stringify(done, null, 2));
    process.stdout.write(`\r  ${q.key} → ${done[q.key].gm?.toFixed(2) ?? "-"}   `);
    await sleep(RATE_MS);
  }
  console.log("\n기준값 완료");
  return done;
}

const quarterOf = iso => {
  const d = new Date(iso);
  return d.getFullYear() + String(Math.floor(d.getMonth() / 3) * 3 + 1).padStart(2, "0");
};

async function collectArtists(baselines) {
  const catalog = load(path.join(dir, "catalog.json"), null);
  if (!catalog) { console.error("catalog.json 이 없다. build-catalog.mjs 먼저."); process.exit(1); }
  const out = load(outPath, {});
  // 실패로 남은 것도 다시 집는다. 끊긴 요청은 대개 다음 판에 그냥 된다
  const todo = catalog.filter(r => !out[r.tag] || out[r.tag].error);
  console.log("작가", catalog.length, "명 중", todo.length, "명 남음");

  const started = Date.now();
  for (let i = 0; i < todo.length; i++) {
    const { tag } = todo[i];
    const url = `${API}/posts.json?tags=${encodeURIComponent(tag)}+order%3Arandom`
      + `&limit=${SAMPLE}&only=score,created_at`;
    let posts;
    try { posts = await get(url); }
    catch (err) { out[tag] = { error: String(err.message || err) }; fs.writeFileSync(outPath, JSON.stringify(out, null, 2)); continue; }

    // 시대 효과를 없앤다. 각 게시물을 자기 분기 기준값으로 나눈 뒤 기하평균
    const ratios = [];
    for (const p of posts) {
      const base = baselines[quarterOf(p.created_at)];
      if (!base || !base.gm || base.gm <= 0) continue;
      ratios.push((Math.max(0, p.score) + 1) / (base.gm + 1));
    }
    out[tag] = {
      n: posts.length,
      rawGm: geometricMean(posts.map(p => p.score)),
      normGm: ratios.length ? Math.exp(ratios.reduce((s, v) => s + Math.log(v), 0) / ratios.length) : null,
    };
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

    const done = i + 1, per = (Date.now() - started) / done;
    const left = Math.round(per * (todo.length - done) / 60000);
    process.stdout.write(`\r  ${done}/${todo.length}  ${tag.padEnd(30).slice(0, 30)} 남은시간 약 ${left}분   `);
    await sleep(RATE_MS);
  }
  console.log("\n완료 →", outPath);
}

const check = process.argv.includes("--check");
try {
  await get(`${API}/tags.json?search%5Bname_comma%5D=lack&limit=1&only=name`);
  console.log("연결 OK — VPN 켜져 있다");
} catch (err) {
  console.error("단부루에 못 붙는다:", err.message);
  console.error("VPN 켜고 다시. 이 스크립트는 원격 스크레이퍼를 안 쓴다 — 요청 수가 너무 많다.");
  process.exit(1);
}
if (!check) {
  const baselines = await collectBaselines();
  await collectArtists(baselines);
}
