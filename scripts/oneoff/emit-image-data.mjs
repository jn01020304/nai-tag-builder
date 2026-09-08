// 이미지 URL 을 목업에 인라인할 수 있게 줄인다.
// CDN 경로는 해시에서 완전히 복원된다 — 앞 두 글자와 그 다음 두 글자가 곧 디렉터리다.
//   https://cdn.donmai.us/180x180/10/7d/107d9f....jpg
//   https://cdn.donmai.us/sample/10/7d/sample-107d9f....jpg
// 그래서 해시와 종류·확장자만 남기면 URL 두 개를 다 만들 수 있다.

import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("exports/artist-mining");
const images = JSON.parse(fs.readFileSync(path.join(dir, "images.json"), "utf8"));

const STILL = new Set(["jpg", "jpeg", "png", "gif", "webp"]); // mp4·webm 은 img 로 못 띄운다
const out = {};
let kept = 0, dropped = 0, artistsWithNone = 0;

for (const [tag, list] of Object.entries(images)) {
  if (!Array.isArray(list)) continue;
  const rows = [];
  for (const p of list) {
    const m = String(p.full || "").match(/\/(sample|original)\/[0-9a-f]{2}\/[0-9a-f]{2}\/(?:sample-)?([0-9a-f]{32})\.([a-z0-9]+)$/);
    if (!m) { dropped++; continue; }
    const [, kind, hash, ext] = m;
    if (!STILL.has(ext)) { dropped++; continue; }
    rows.push(hash + "." + kind[0] + "." + ext);
    kept++;
  }
  if (rows.length) out[tag] = rows;
  else artistsWithNone++;
}

const lines = [
  "// 작가별 대표 이미지. 해시만 저장하고 URL 은 실행 중에 조립한다.",
  "// 형식: \"<md5>.<s|o>.<ext>\"  s=sample, o=original",
  "// 여기 없는 작가는 단부루가 이미지를 안 준다 (작가 요청 비공개). 빈 칸이 아니라 그렇게 표시할 것.",
  "const IMAGES=" + JSON.stringify(out) + ";",
  "const imgDir=h=>h.slice(0,2)+\"/\"+h.slice(2,4);",
  "const thumbUrl=e=>{const h=e.split(\".\")[0]; return \"https://cdn.donmai.us/180x180/\"+imgDir(h)+\"/\"+h+\".jpg\"};",
  "const fullUrl=e=>{const [h,k,x]=e.split(\".\"); return k===\"s\"",
  "  ? \"https://cdn.donmai.us/sample/\"+imgDir(h)+\"/sample-\"+h+\".\"+x",
  "  : \"https://cdn.donmai.us/original/\"+imgDir(h)+\"/\"+h+\".\"+x};",
];

const outPath = path.join(dir, "mockup-images.js");
fs.writeFileSync(outPath, lines.join("\n") + "\n");
console.log("작가", Object.keys(out).length, "명 / 이미지", kept, "장 /",
  (fs.statSync(outPath).size / 1024).toFixed(0) + "KB");
console.log("제외한 이미지", dropped, "장 (영상·형식불명) / 쓸 그림이 하나도 없는 작가", artistsWithNone, "명");
