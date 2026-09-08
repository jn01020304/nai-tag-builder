// 발굴된 작가 이름을 단부루 tags.json 배치 URL 로 쪼갠다.
// 제연 PC 에서 호스트가 안 뚫리므로 이 URL 들은 원격으로 받아온다.

import fs from "node:fs";
import path from "node:path";

const src = path.resolve("exports/artist-mining/artists.json");
const rows = JSON.parse(fs.readFileSync(src, "utf8"));

// 단부루 태그는 언더스코어 표기다. 원래 언더스코어였던 이름이 겹쳐 __ 가 되지 않게 접는다
const toTag = n => n.trim().toLowerCase()
  .replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
const names = [...new Set(rows.map(r => toTag(r.name)))].filter(Boolean).sort();

const BATCH = 70;
const urls = [];
for (let i = 0; i < names.length; i += BATCH) {
  const chunk = names.slice(i, i + BATCH);
  urls.push("https://danbooru.donmai.us/tags.json?search%5Bname_comma%5D="
    + chunk.map(encodeURIComponent).join(",")
    + "&limit=1000&only=name,post_count,category,is_deprecated");
}

const outDir = path.resolve("exports/artist-mining");
fs.writeFileSync(path.join(outDir, "tag-batch-urls.json"), JSON.stringify(urls, null, 2));
fs.writeFileSync(path.join(outDir, "mined-names.json"), JSON.stringify(names, null, 2));
console.log("이름", names.length, "개 →", urls.length, "배치");
urls.forEach((u, i) => console.log("[" + i + "] 길이", u.length));
