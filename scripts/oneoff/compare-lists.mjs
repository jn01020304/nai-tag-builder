// 제연이 인기순으로 따로 모아온 목록과 이미지 더미에서 발굴한 목록을 겹쳐본다.

import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("exports/artist-mining");
const toTag = n => n.trim().toLowerCase()
  .replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

const his = [...new Set(fs.readFileSync(path.join(dir, "jeyeon-list.txt"), "utf8")
  .split(",").map(s => toTag(s)).filter(Boolean))];
const mined = JSON.parse(fs.readFileSync(path.join(dir, "mined-names.json"), "utf8"));
const alive = new Set(JSON.parse(fs.readFileSync(path.join(dir, "candidates.json"), "utf8")).map(r => r.tag));
const dan = JSON.parse(fs.readFileSync(path.join(dir, "danbooru-tags.json"), "utf8"));
delete dan._note;

const minedSet = new Set(mined);
const bothWays = his.filter(t => minedSet.has(t));
const onlyHis = his.filter(t => !minedSet.has(t));
const onlyMined = mined.filter(t => !his.includes(t));

// 그의 목록 중 이미 단부루 대조가 끝난 것 / 아직 안 된 것
const known = onlyHis.filter(t => dan[t]);
const unchecked = onlyHis.filter(t => !dan[t]);

const union = [...new Set([...his, ...mined])];
fs.writeFileSync(path.join(dir, "union-names.json"), JSON.stringify(union.sort(), null, 2));
fs.writeFileSync(path.join(dir, "unchecked-names.json"), JSON.stringify(unchecked.sort(), null, 2));

console.log("제연 목록", his.length, "명 / 발굴 목록", mined.length, "명");
console.log("겹치는 이름", bothWays.length, "→ 제연 목록의", (bothWays.length / his.length * 100).toFixed(0) + "%");
console.log("제연 목록에만", onlyHis.length, " / 발굴에만", onlyMined.length);
console.log("합집합", union.length, "명");
console.log("\n제연 목록 중 아직 단부루 대조 안 된 이름", unchecked.length);
console.log("겹친 이름 중 발굴 쪽에서 유령/0장으로 걸러진 것:",
  bothWays.filter(t => !alive.has(t)).join(", ") || "없음");

const BATCH = 70;
const urls = [];
for (let i = 0; i < unchecked.length; i += BATCH) {
  urls.push("https://danbooru.donmai.us/tags.json?search%5Bname_comma%5D="
    + unchecked.slice(i, i + BATCH).map(encodeURIComponent).join(",")
    + "&limit=1000&only=name,post_count,category,is_deprecated");
}
fs.writeFileSync(path.join(dir, "unchecked-batch-urls.json"), JSON.stringify(urls, null, 2));
console.log("추가로 필요한 조회", urls.length, "번");
