// 목업에 인라인으로 박을 데이터 블록을 만든다. file:// 로 열리므로 외부 fetch 를 못 쓴다.

import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("exports/artist-mining");
const asset = JSON.parse(fs.readFileSync(path.join(dir, "artist-catalog.json"), "utf8"));

// [pop, train] 배열로 줄여서 크기를 줄인다
const dan = {};
for (const a of asset.artists) dan[a.tag] = [a.pop, a.train];

const lines = [];
lines.push("// 실측 데이터. 2026-08-24 수집, 작가 " + asset.count + "명.");
lines.push("// pop = 시대 보정 인기도(자기 분기 평균 대비 기하평균, 1.0 이 그 시절 평균), train = Danbooru 장수.");
lines.push("// 둘의 로그 상관은 0.06 이라 서로 다른 것을 잰다. 인기 많다고 학습량이 많은 게 아니다.");
lines.push("const DAN_RAW=" + JSON.stringify(dan) + ";");
lines.push("// 옛 이름 -> 현행 태그. 프롬프트에 남은 오타·개명을 통계에 연결한다.");
lines.push("const ALIAS=" + JSON.stringify(asset.alias) + ";");

fs.writeFileSync(path.join(dir, "mockup-data.js"), lines.join("\n") + "\n");
console.log("작성", (fs.statSync(path.join(dir, "mockup-data.js")).size / 1024).toFixed(0) + "KB");
