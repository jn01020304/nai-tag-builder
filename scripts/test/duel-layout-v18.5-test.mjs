import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../../mockup/shell-v18.5-nightly.html", import.meta.url), "utf8");
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (!/application\/json|\bsrc=/.test(match[1])) new vm.Script(match[2]);
}
const extract = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
const context = vm.createContext({
  esc: value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
  fmt: value => String(value)
});
vm.runInContext(extract("function longestCommonArtistBlock(", "function renderDuelCompositions("), context);
vm.runInContext(extract("function useDuelBottomBar(", "function syncDuelLayout("), context);
const block = (left, right) => JSON.parse(JSON.stringify(context.longestCommonArtistBlock(left, right)));
assert.deepEqual(block(["A", "B", "C", "D", "E", "F", "G", "H"], ["F", "G", "A", "B", "C", "D", "H"]), { leftStart: 0, rightStart: 2, length: 4 });
assert.deepEqual(block(["A", "B", "X", "C", "D"], ["C", "D", "Y", "A", "B"]), { leftStart: 3, rightStart: 0, length: 2 });
assert.deepEqual(block(["A", "B"], ["A", "B", "X", "A", "B"]), { leftStart: 0, rightStart: 3, length: 2 });
assert.deepEqual(block([], ["A"]), { leftStart: -1, rightStart: -1, length: 0 });
assert.equal(block(["A"], ["B"]).length, 0);
assert.deepEqual(block(["A", "A", "A"], ["A", "A"]), { leftStart: 1, rightStart: 0, length: 2 });
assert.equal(block(["A", "B", "C"], ["A", "X", "B", "Y", "C"]).length, 1);
// 작은 배열 전수 비교로 반복 작가와 동률 처리를 확인한다.
const arrays = [[]];
for (let length = 1; length <= 4; length++) {
  for (let bits = 0; bits < 2 ** length; bits++) arrays.push(Array.from({ length }, (_, i) => (bits >> i) & 1 ? "A" : "B"));
}
for (const left of arrays) for (const right of arrays) {
  let expected = { leftStart: -1, rightStart: -1, length: 0 };
  for (let i = 0; i < left.length; i++) for (let j = 0; j < right.length; j++) {
    let length = 0;
    while (i + length < left.length && j + length < right.length && left[i + length] === right[j + length]) length++;
    if (length && length >= expected.length) expected = { leftStart: i, rightStart: j, length };
  }
  assert.deepEqual(block(left, right), expected);
}
const rows = [["A", 1], ["B", .5], ["<C>", 2]];
const rendered = context.duelArtistList(rows, 0, 2, true);
assert.equal((rendered.match(/class="duel-common-block"/g) || []).length, 1);
assert.ok(rendered.includes("&lt;C>"));
assert.ok(rendered.includes("<small>0.5</small>"));
assert.ok(!context.duelArtistList(rows, 0, 2, false).includes("<small>"));
assert.ok(!context.duelArtistList(rows, -1, 0, true).includes("duel-common-block"));
assert.equal(context.useDuelBottomBar([832 / 1216], 1500), false);
assert.equal(context.useDuelBottomBar([1], 1500), true);
assert.equal(context.useDuelBottomBar([1216 / 832], 1500), true);
assert.equal(context.useDuelBottomBar([.7, 1.5], 1500), true);
assert.equal(context.useDuelBottomBar([.7], 1000), true);
assert.equal(context.useDuelBottomBar([NaN], 1500), false);

const classes = new Set(["chunkDuel"]);
const images = {
  duelLeftImage: { complete: false, naturalWidth: 0, naturalHeight: 0, getAttribute: () => "image-a" },
  duelRightImage: { complete: false, naturalWidth: 0, naturalHeight: 0, getAttribute: () => "image-b" }
};
context.document = {
  body: { classList: { contains: name => classes.has(name), toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) } },
  getElementById: id => images[id]
};
context.sideL = { parentElement: { clientWidth: 1500 } };
context.duelPayloads = { left: { resolution: { width: 832, height: 1216 } }, right: null };
context.experimentSnapshot = { payload: { resolution: { width: 832, height: 1216 } } };
vm.runInContext(extract("function syncDuelLayout(", "let duelLayoutFrame"), context);
context.syncDuelLayout();
assert.ok(classes.has("duel-adaptive") && !classes.has("duel-bottom"));
Object.assign(images.duelLeftImage, { complete: true, naturalWidth: 1200, naturalHeight: 800 });
context.syncDuelLayout();
assert.ok(classes.has("duel-bottom"));
classes.delete("chunkDuel");
context.syncDuelLayout();
assert.ok(!classes.has("duel-adaptive") && !classes.has("duel-bottom"));
const host = { innerHTML: "" };
images.duelCompositions = host;
context.scheduleDuelLayout = () => {};
vm.runInContext(extract("function renderDuelCompositions(", "function useDuelBottomBar("), context);
context.duelPayloads = { left: { artists: rows }, right: { artists: [["A", 2], ["B", 3]] } };
context.renderDuelCompositions();
assert.ok(host.innerHTML.includes("3명") && host.innerHTML.includes("2명"));
assert.ok(!host.innerHTML.includes("duel-common-block"));
context.duelPayloads.right.artists.push(["D", 1]);
context.renderDuelCompositions();
assert.equal((host.innerHTML.match(/class="duel-common-block"/g) || []).length, 2);
classes.add("chunkTune");
context.renderDuelCompositions();
assert.ok(!host.innerHTML.includes("<small>"));
for (const [left, right, expected] of [
  [["A", "B", "C", "D"], ["D", "E", "F"], 0],
  [["A", "B", "C"], ["A", "B", "C"], 0],
  [["A", "B"], ["A", "B", "C", "D"], 2],
  [["A", "B", "C", "D"], ["A", "B", "C", "D"], 2],
  [["A", "A", "B"], ["A", "A", "C"], 0]
]) {
  context.duelPayloads = Object.fromEntries([left, right].map((names, index) => [index ? "right" : "left", { artists: names.map(name => [name, 1]) }]));
  context.renderDuelCompositions();
  assert.equal((host.innerHTML.match(/class="duel-common-block"/g) || []).length, expected);
}
context.duelPayloads = { left: null, right: null };
context.renderDuelCompositions();
assert.ok(!host.innerHTML.includes("duel-common-block"));
assert.ok(!html.includes("tournamentBracket"));
console.log("PASS: inline syntax, 961 common-block cases, markup, aspect ratios, image loading, and layout exit");
