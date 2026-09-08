// 수집 결과를 프로그램이 바로 읽을 자산 하나로 묶는다.
//   pop   = 시대 보정 인기도 (자기 분기 기준값 대비 기하평균). 1.0 이 그 시절 평균
//   train = 학습량 (Danbooru 장수)
// 두 값은 서로 다른 것을 재므로 둘 다 남긴다.

import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("exports/artist-mining");
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));

const catalog = read("catalog.json");
const scores = read("scores.json");
const fixes = read("tag-fixes.json");

const rows = [];
let missing = 0;
for (const r of catalog) {
  const s = scores[r.tag];
  if (!s || s.error || s.normGm == null) { missing++; continue; }
  rows.push({
    tag: r.tag,
    pop: Number(s.normGm.toFixed(3)),
    train: r.postCount,
    n: s.n,
    used: r.count,
    src: r.src,
  });
}
rows.sort((a, b) => b.pop - a.pop);

// 옛 이름 -> 현행 태그. 프롬프트의 옛 이름을 통계에 연결하는 데 쓴다
const alias = {};
for (const f of fixes) if (f.to) alias[f.tag] = f.to;

// 발굴 목록엔 없지만 제연이 실제 프롬프트에서 쓰는 것으로 확인된 오타
Object.assign(alias, { "riich": "riichu" });

const asset = { version: 1, collected: "2026-08-24", count: rows.length, alias, artists: rows };
fs.writeFileSync(path.join(dir, "artist-catalog.json"), JSON.stringify(asset));
fs.writeFileSync(path.join(dir, "artist-catalog.pretty.json"), JSON.stringify(asset, null, 2));

const size = fs.statSync(path.join(dir, "artist-catalog.json")).size;
const corr = (() => {
  const xs = rows.map(r => Math.log(r.pop)), ys = rows.map(r => Math.log(r.train));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
})();

console.log("자산", rows.length, "명 /", (size / 1024).toFixed(0) + "KB / 별칭", Object.keys(alias).length, "개");
if (missing) console.log("점수 없어서 빠진 것", missing, "명");
console.log("인기도와 학습량의 상관(로그):", corr.toFixed(3), "— 0 에 가까우면 서로 다른 것을 재고 있다는 뜻");
console.log("\n인기도 상위 15");
for (const r of rows.slice(0, 15))
  console.log("  " + r.tag.padEnd(28), "pop", String(r.pop).padStart(6), " 장수", String(r.train).padStart(5),
    r.used ? " 내가 " + r.used + "회" : "");
console.log("\n인기도 하위 8");
for (const r of rows.slice(-8))
  console.log("  " + r.tag.padEnd(28), "pop", String(r.pop).padStart(6), " 장수", String(r.train).padStart(5));
