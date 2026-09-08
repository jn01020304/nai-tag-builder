// 두 경로로 모은 이름을 하나의 후보 카탈로그로 합친다.
//   mined  = 제연 이미지 더미에서 발굴 (그가 실제로 써본 작가)
//   listed = 제연이 인기순으로 따로 수집 (그가 아직 안 써본 인기 작가)

import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("exports/artist-mining");
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
const toTag = n => n.trim().toLowerCase()
  .replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

const dan = { ...read("danbooru-tags.json"), ...read("danbooru-tags-jeyeon.json") };
delete dan._note;

const mined = read("artists.json");
const minedNames = new Set(read("mined-names.json"));
const listed = new Set(fs.readFileSync(path.join(dir, "jeyeon-list.txt"), "utf8")
  .split(",").map(toTag).filter(Boolean));

const usage = new Map();
for (const row of mined) {
  const tag = toTag(row.name);
  const prev = usage.get(tag) || { count: 0, byText: 0, byStealth: 0 };
  usage.set(tag, {
    count: prev.count + row.count,
    byText: prev.byText + row.byText,
    byStealth: prev.byStealth + row.byStealth,
  });
}

const all = [...new Set([...minedNames, ...listed])];
const catalog = [], rejected = { ghost: [], empty: [], nonArtist: [] };

for (const tag of all) {
  const use = usage.get(tag) || { count: 0, byText: 0, byStealth: 0 };
  const src = [minedNames.has(tag) && "mined", listed.has(tag) && "listed"].filter(Boolean);
  const hit = dan[tag];
  if (!hit) { rejected.ghost.push({ tag, src, ...use }); continue; }
  const [postCount, category, deprecated] = hit;
  if (category !== 1) { rejected.nonArtist.push({ tag, src, postCount, category }); continue; }
  if (postCount === 0 || deprecated) { rejected.empty.push({ tag, src, postCount, deprecated, ...use }); continue; }
  catalog.push({ tag, postCount, src, ...use });
}

catalog.sort((a, b) => b.postCount - a.postCount);
fs.writeFileSync(path.join(dir, "catalog.json"), JSON.stringify(catalog, null, 2));
fs.writeFileSync(path.join(dir, "catalog-rejected.json"), JSON.stringify(rejected, null, 2));

const by = s => catalog.filter(r => r.src.includes(s)).length;
const both = catalog.filter(r => r.src.length === 2).length;
const bucket = n => catalog.filter(r => r.postCount >= n).length;

console.log("최종 카탈로그", catalog.length, "명");
console.log("  발굴 경로", by("mined"), " 수집 경로", by("listed"), " 양쪽 다", both);
console.log("  버림 — 유령", rejected.ghost.length, "/ 0장·폐기", rejected.empty.length, "/ 작가 아님", rejected.nonArtist.length);
console.log("문턱별:  100+", bucket(100), " 200+", bucket(200), " 500+", bucket(500), " 1000+", bucket(1000));
console.log("\n제연이 써봤지만 카탈로그에서 잘린 태그 (프롬프트에서 빼야 할 것)");
for (const r of [...rejected.ghost, ...rejected.empty].filter(r => r.count > 0).sort((a, b) => b.count - a.count))
  console.log("  " + r.tag.padEnd(28), "사용", String(r.count).padStart(4), r.postCount === undefined ? "단부루에 없음" : "0장");
