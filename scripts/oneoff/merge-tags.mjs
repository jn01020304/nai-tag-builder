// 발굴 결과와 단부루 대조 결과를 합쳐 최종 후보 목록을 만든다.
// 응답에 아예 안 들어온 이름은 단부루에 존재하지 않는 태그다 = 유령.

import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("exports/artist-mining");
const mined = JSON.parse(fs.readFileSync(path.join(dir, "artists.json"), "utf8"));
const names = JSON.parse(fs.readFileSync(path.join(dir, "mined-names.json"), "utf8"));
const dan = JSON.parse(fs.readFileSync(path.join(dir, "danbooru-tags.json"), "utf8"));
delete dan._note;

const toTag = n => n.trim().toLowerCase()
  .replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

const usage = new Map();
for (const row of mined) {
  const tag = toTag(row.name);
  const prev = usage.get(tag);
  if (prev) { prev.count += row.count; prev.byText += row.byText; prev.byStealth += row.byStealth; }
  else usage.set(tag, { count: row.count, byText: row.byText, byStealth: row.byStealth });
}

const rows = [], ghosts = [], empty = [], nonArtist = [];
for (const tag of names) {
  const use = usage.get(tag) || { count: 0, byText: 0, byStealth: 0 };
  const hit = dan[tag];
  if (!hit) { ghosts.push({ tag, ...use }); continue; }
  const [postCount, category, deprecated] = hit;
  if (category !== 1) { nonArtist.push({ tag, postCount, category, ...use }); continue; }
  if (postCount === 0 || deprecated) { empty.push({ tag, postCount, deprecated, ...use }); continue; }
  rows.push({ tag, postCount, ...use });
}

rows.sort((a, b) => b.postCount - a.postCount);
const bucket = n => rows.filter(r => r.postCount >= n).length;

fs.writeFileSync(path.join(dir, "candidates.json"), JSON.stringify(rows, null, 2));
fs.writeFileSync(path.join(dir, "rejected.json"), JSON.stringify({ ghosts, empty, nonArtist }, null, 2));

console.log("발굴 이름", names.length);
console.log("  살아있는 작가 태그", rows.length);
console.log("  단부루에 없는 유령", ghosts.length, "→", ghosts.map(g => g.tag).join(", "));
console.log("  0장이거나 폐기됨", empty.length, "→", empty.map(e => e.tag).join(", "));
console.log("  작가 카테고리 아님", nonArtist.length, "→", nonArtist.map(e => e.tag + "(cat" + e.category + ")").join(", "));
console.log("\n문턱별 인원:  100장+", bucket(100), " 200장+", bucket(200), " 500장+", bucket(500), " 1000장+", bucket(1000));
console.log("\n장수 상위 12");
for (const r of rows.slice(0, 12))
  console.log("  " + r.tag.padEnd(30), String(r.postCount).padStart(5), " 내가 쓴 횟수", r.count);
console.log("\n남의 그림에서만 나온 것 중 장수 많은 순 12");
for (const r of rows.filter(r => r.byText === 0).slice(0, 12))
  console.log("  " + r.tag.padEnd(30), String(r.postCount).padStart(5), " 남이 쓴 횟수", r.byStealth);
