// 일회성 발굴 툴: 기존 NAI 이미지 더미에서 실제로 써온 작가 태그를 캐낸다.
// 쓰고 버릴 물건이지만 결과 파일은 남긴다.
//   node scripts/oneoff/mine-artists.mjs "D:/Archive-NAI" "D:/Archive-NAI-Data"

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { decodeStealthMetadata } from "./stealth-lsb.mjs";

const roots = process.argv.slice(2);
if (!roots.length) {
  console.error("사용법: node scripts/oneoff/mine-artists.mjs <폴더> [폴더...]");
  process.exit(1);
}

const outDir = path.resolve("exports/artist-mining");
const stats = { files: 0, png: 0, fromText: 0, fromStealth: 0, noMeta: 0, badJson: 0, itxt: 0 };

// PNG 텍스트 청크. NAI는 보통 tEXt에 쓰지만 iTXt/zTXt로 들어간 파일도 섞여 있다
function readTextChunks(buf) {
  const out = {};
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return out;
  let p = 8;
  while (p + 12 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    if (len < 0 || p + 12 + len > buf.length) break;
    const data = buf.subarray(p + 8, p + 8 + len);
    try {
      if (type === "tEXt") {
        const z = data.indexOf(0);
        if (z > 0) out[data.toString("latin1", 0, z)] = data.toString("latin1", z + 1);
      } else if (type === "zTXt") {
        const z = data.indexOf(0);
        if (z > 0) {
          const body = zlib.inflateSync(data.subarray(z + 2)).toString("utf8");
          out[data.toString("latin1", 0, z)] = body;
        }
      } else if (type === "iTXt") {
        const z = data.indexOf(0);
        if (z > 0) {
          const key = data.toString("utf8", 0, z);
          const compressed = data[z + 1] === 1;
          let q = z + 3;
          q = data.indexOf(0, q) + 1; // 언어 태그
          q = data.indexOf(0, q) + 1; // 번역된 키
          const body = data.subarray(q);
          out[key] = compressed ? zlib.inflateSync(body).toString("utf8") : body.toString("utf8");
          stats.itxt++;
        }
      }
    } catch { /* 깨진 청크는 건너뛴다 */ }
    if (type === "IEND") break;
    p += 12 + len;
  }
  return out;
}

// "1.5::artist:riichu::" 뿐 아니라 남의 프롬프트에 섞인 [[ ]] { } 가중치 표기까지 견뎌야 한다.
// 여기서 대충 자르면 ciloranko]] 같은 유령 작가가 카탈로그에 들어간다.
function normalizeArtist(raw) {
  let n = raw.split(/[,\n|]/)[0];
  n = n.split("::")[0];
  n = n.replace(/[\[\]{}]/g, " ");        // 가중치 괄호는 이름의 일부가 아니다
  n = n.replace(/\s+/g, " ").trim().toLowerCase();
  n = n.replace(/^[:_-]+|[:_-]+$/g, "").trim();
  if (!n || n === "artist" || n.includes(":")) return null;
  if (!/^[a-z0-9]/.test(n)) return null;
  n = n.replace(/([^\s(])\(/g, "$1 (");   // "ask(askzy)" -> "ask (askzy)"
  const open = (n.match(/\(/g) || []).length, close = (n.match(/\)/g) || []).length;
  if (open !== close) return null;        // 괄호가 안 닫히면 잘린 이름이다
  return n;
}
function artistsIn(prompt) {
  const found = [];
  // 구분자까지만 먹어야 한다. 줄 끝까지 먹으면 같은 줄의 뒤쪽 artist: 들이 통째로 날아간다
  const re = /artist:\s*([^,\n|]*)/gi;
  let m;
  while ((m = re.exec(prompt))) {
    const name = normalizeArtist(m[1]);
    if (name) found.push(name);
  }
  return found;
}

function weightOf(prompt, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp("([\\d.]+)::artist:" + esc + "::", "i").exec(prompt);
  return m ? Number(m[1]) : 1;
}

function* walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const artists = new Map();   // 이름 -> { count, byText, byStealth, weights[], samples[] }
const pairs = new Map();     // "a|b" -> 동시 등장 횟수
const prompts = [];

function bump(name, weight, file, source) {
  let rec = artists.get(name);
  if (!rec) { rec = { count: 0, byText: 0, byStealth: 0, weights: [], samples: [] }; artists.set(name, rec); }
  rec.count++;
  if (source === "stealth") rec.byStealth++; else rec.byText++;
  rec.weights.push(weight);
  if (rec.samples.length < 3) rec.samples.push(path.basename(file));
}

// PNG 청크가 비어 있으면 알파 채널에 숨겨진 쪽을 본다.
// 청크가 날아갔다는 건 대개 어딘가에 업로드됐다 다시 받은 것 = 남의 그림이다.
function readMeta(buf) {
  const chunks = readTextChunks(buf);
  if (chunks.Comment) {
    try { return { meta: JSON.parse(chunks.Comment), source: "text" }; }
    catch { return { bad: true }; }
  }
  const hidden = decodeStealthMetadata(buf);
  if (!hidden) return null;
  const inner = hidden.Comment ?? hidden.comment;
  if (typeof inner === "string") {
    try { return { meta: JSON.parse(inner), source: "stealth" }; } catch { /* 아래로 */ }
  }
  if (typeof hidden.prompt === "string") return { meta: hidden, source: "stealth" };
  return null;
}

for (const root of roots) {
  if (!fs.existsSync(root)) { console.error("없는 경로:", root); continue; }
  for (const file of walk(root)) {
    stats.files++;
    let buf;
    try { buf = fs.readFileSync(file); } catch { continue; }
    // 확장자가 아니라 매직 바이트로 판별한다 — 확장자 없는 파일이 섞여 있다
    if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) continue;
    stats.png++;

    let read;
    try { read = readMeta(buf); } catch { read = null; }
    if (read?.bad) { stats.badJson++; continue; }
    if (!read) { stats.noMeta++; continue; }
    const { meta, source } = read;
    const prompt = String(meta.prompt || "");
    if (!prompt) { stats.noMeta++; continue; }
    if (source === "stealth") stats.fromStealth++; else stats.fromText++;

    const names = [...new Set(artistsIn(prompt))];
    for (const n of names) bump(n, weightOf(prompt, n), file, source);
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++) {
        const key = [names[i], names[j]].sort().join("|");
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }

    prompts.push({
      file: path.relative(root, file), source,
      artists: names,
      steps: meta.steps, scale: meta.scale, sampler: meta.sampler,
      width: meta.width, height: meta.height, seed: meta.seed,
    });
  }
}

const parsed = stats.fromText + stats.fromStealth;
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const rows = [...artists.entries()]
  .map(([name, r]) => ({
    name,
    count: r.count,
    byText: r.byText,
    byStealth: r.byStealth,
    share: +(r.count / Math.max(1, parsed) * 100).toFixed(1),
    meanWeight: +mean(r.weights).toFixed(2),
    maxWeight: Math.max(...r.weights),
    samples: r.samples,
  }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

// 실제로 쓴 생성 설정 분포. 프로브를 고정할 값이 여기서 나온다
const dist = key => {
  const m = new Map();
  for (const p of prompts) {
    const v = key(p);
    if (v == null) continue;
    m.set(v, (m.get(v) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "artists.json"), JSON.stringify(rows, null, 2));
fs.writeFileSync(path.join(outDir, "prompts.json"), JSON.stringify(prompts, null, 2));
fs.writeFileSync(path.join(outDir, "pairs.json"), JSON.stringify(
  [...pairs.entries()].map(([k, v]) => ({ pair: k.split("|"), count: v }))
    .sort((a, b) => b.count - a.count), null, 2));

console.log("훑은 파일", stats.files, "/ png", stats.png,
  "/ 청크", stats.fromText, "/ 스텔스", stats.fromStealth,
  "/ 메타없음", stats.noMeta, "/ json깨짐", stats.badJson);
console.log("발굴된 작가", rows.length, "명");

// 남의 그림에만 있는 작가 = 내가 아직 안 써본 작가. 발굴의 본체가 여기다
const unseen = rows.filter(r => r.byText === 0 && r.byStealth > 0);
console.log("그중 내 그림엔 없고 남의 그림에만 있는 작가", unseen.length, "명\n");

console.log("상위 25명 (총 · 내것 · 남의것 · 비중 · 평균가중치)");
for (const r of rows.slice(0, 25))
  console.log("  " + r.name.padEnd(24), String(r.count).padStart(4), String(r.byText).padStart(5),
    String(r.byStealth).padStart(5), (r.share + "%").padStart(7), String(r.meanWeight).padStart(6));

console.log("\n새로 발굴된 작가 (남의 그림에서만 나온 것, 등장수 순)");
for (const r of unseen.slice(0, 40))
  console.log("  " + r.name.padEnd(28), String(r.byStealth).padStart(3));
console.log("\n생성 설정 분포");
console.log("  크기   ", dist(p => p.width + "x" + p.height).slice(0, 4).map(([k, v]) => k + "×" + v).join("  "));
console.log("  스텝   ", dist(p => p.steps).slice(0, 4).map(([k, v]) => k + "×" + v).join("  "));
console.log("  스케일 ", dist(p => p.scale).slice(0, 4).map(([k, v]) => k + "×" + v).join("  "));
console.log("  샘플러 ", dist(p => p.sampler).slice(0, 4).map(([k, v]) => k + "×" + v).join("  "));
console.log("\n같이 자주 쓴 짝 상위 10");
for (const { pair, count } of [...pairs.entries()].map(([k, v]) => ({ pair: k.split("|"), count: v }))
  .sort((a, b) => b.count - a.count).slice(0, 10))
  console.log("  " + (pair[0] + " + " + pair[1]).padEnd(46), count);
console.log("\n저장 위치:", outDir);
