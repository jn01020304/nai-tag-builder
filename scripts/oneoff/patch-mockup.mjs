// 목업의 작가 데이터 블록을 실측 자산으로 갈아끼운다. 여러 번 돌려도 같은 결과가 되게 한다.
// 대상 구간: 데이터 시작 ~ `const sortVal={` 직전.

import fs from "node:fs";
import path from "node:path";

const htmlPath = path.resolve("mockup/shell-v18.html");
const dataPath = path.resolve("exports/artist-mining/mockup-data.js");
let html = fs.readFileSync(htmlPath, "utf8");
const data = fs.readFileSync(dataPath, "utf8").trimEnd();

const startMarkers = ["const DAN={", "// 실측 데이터."];
const start = startMarkers.map(m => html.indexOf(m)).filter(i => i >= 0).sort((a, b) => a - b)[0];
const end = html.indexOf("const sortVal={");
if (start === undefined || end < 0 || end < start) { console.error("블록을 못 찾았다"); process.exit(1); }

const helpers = `
// 태그는 언더스코어, 프롬프트는 공백. 조회 시점에 맞춰준다
const tagOf=n=>String(n).trim().toLowerCase().replace(/\\s+/g,"_").replace(/_+/g,"_");
const spaced=t=>String(t).replace(/_/g," ");
const canonTag=n=>{const t=tagOf(shortName(n)); return ALIAS[t]||t};
const canonName=n=>spaced(canonTag(n));
const aliasOf=n=>{const t=tagOf(shortName(n)); return ALIAS[t]?spaced(t):null};
const danOf=(n,f)=>{
  const d=DAN_RAW[canonTag(n)];
  if(!d)return null;
  return f==="pop"?d[0]:d[1];
};
`.trim();

html = html.slice(0, start) + data + "\n" + helpers + "\n" + html.slice(end);
fs.writeFileSync(htmlPath, html);
console.log("교체 완료. 파일 크기", (fs.statSync(htmlPath).size / 1024).toFixed(0) + "KB");
