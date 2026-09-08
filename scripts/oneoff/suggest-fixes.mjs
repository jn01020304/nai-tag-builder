// 걸러진 태그마다 살아있는 카탈로그에서 가장 가까운 이름을 찾아 대체안을 낸다.
// 오타는 지우는 게 아니라 고치는 것이고, 개명·중복은 옮기는 것이다.

import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("exports/artist-mining");
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
const catalog = read("catalog.json");
const rejected = read("catalog-rejected.json");

const live = catalog.map(r => r.tag);
const bare = s => s.replace(/[_\-.()!+]/g, "");

function distance(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

// 이름을 단어 집합으로 보고 순서만 뒤바뀐 경우도 잡는다 (noizi_ito ↔ ito_noizi)
const wordKey = s => s.split(/[_\-]/).filter(Boolean).sort().join("_");
const byWordKey = new Map();
for (const t of live) {
  const k = wordKey(t);
  if (!byWordKey.has(k)) byWordKey.set(k, []);
  byWordKey.get(k).push(t);
}

function suggest(tag) {
  const swap = byWordKey.get(wordKey(tag));
  if (swap && !swap.includes(tag)) return { to: swap[0], why: "어순만 다름" };
  const contains = live.filter(t => t !== tag && (t.startsWith(tag + "_(") || bare(t) === bare(tag)));
  if (contains.length) return { to: contains[0], why: "괄호 표기 차이" };
  // 반대 방향도 본다. deadflow -> bee_(deadflow), jp06_(orangemaru) -> jp06
  const inner = live.filter(t => t !== tag &&
    (t.endsWith("_(" + tag + ")") || tag.startsWith(t + "_(")));
  if (inner.length) return { to: inner[0], why: "괄호 표기 차이" };
  let best = null, bestD = Infinity;
  for (const t of live) {
    if (Math.abs(t.length - tag.length) > 3) continue;
    const d = distance(bare(tag), bare(t));
    if (d < bestD) { bestD = d; best = t; }
  }
  // 짧은 이름은 2자만 달라도 완전히 다른 사람이다. 길이 대비로 막는다
  if (best && bestD <= 2 && bestD / bare(tag).length <= 0.25)
    return { to: best, why: "철자 " + bestD + "자 차이" };
  return null;
}

const manual = {
  // 개명. NAI 는 학습 시점 이름을 알고 있으므로 프롬프트는 그대로 두고 카탈로그만 연결한다
  "sho_(sho_lwlw)": { to: "todoroki_masaru", why: "개명 — 프롬프트는 그대로 두고 통계만 연결" },
};

const out = [];
for (const r of [...rejected.ghost, ...rejected.empty]) {
  const s = manual[r.tag] || suggest(r.tag);
  out.push({ tag: r.tag, used: r.count || 0, ...(s || { to: null, why: "대체 후보 없음" }) });
}
out.sort((a, b) => b.used - a.used);
fs.writeFileSync(path.join(dir, "tag-fixes.json"), JSON.stringify(out, null, 2));

console.log("고칠 것 (사용 횟수 순)");
for (const r of out.filter(r => r.to))
  console.log("  " + r.tag.padEnd(26) + " → " + (r.to || "").padEnd(28) + " " + r.why + (r.used ? "  · 사용 " + r.used : ""));
console.log("\n대체 후보를 못 찾은 것 (그냥 빼면 됨)");
console.log("  " + out.filter(r => !r.to).map(r => r.tag + (r.used ? "(" + r.used + ")" : "")).join(", "));
