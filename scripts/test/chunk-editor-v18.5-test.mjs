import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../../mockup/shell-v18.5-nightly.js", import.meta.url), "utf8");
const section = html.slice(html.indexOf("function chunkEditNode("), html.indexOf('chunkEditor.addEventListener("change"'));
const handlers = {};
const host = { innerHTML: "" };
const context = vm.createContext({
  chunkEdit: { root: { kind: "chunk", weight: 1, children: [
    { kind: "artist", tag: "artist:A", weight: 1 },
    { kind: "chunk", name: "nested", weight: .5, children: [{ kind: "artist", tag: "artist:B", weight: .8 }] }
  ] } },
  chunkEditor: { querySelector: () => host, addEventListener: (name, handler) => { handlers[name] = handler; } },
  esc: value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;"),
  shortName: name => name.replace(/^artist:/i, ""),
  round2: value => Math.round(value * 100) / 100,
  clampNodeW: value => Math.min(10, Math.max(0, value))
});
vm.runInContext(section, context);
vm.runInContext(html.slice(html.indexOf('chunkEditor.addEventListener("change"'), html.indexOf('chunkEditor.addEventListener("click"')), context);
vm.runInContext("renderChunkEditor()", context);
assert.match(host.innerHTML, /data-edit-path="1.0"/);
assert.match(host.innerHTML, /value="0.8"/);
const change = (field, value, number) => handlers.change({ target: {
  closest: () => ({ dataset: { editPath: "1.0" } }),
  matches: selector => selector === `[data-edit-${field}]`, value, valueAsNumber: number
} });
change("name", "artist:C");
assert.equal(context.chunkEdit.root.children[1].children[0].tag, "artist:C");
assert.equal(context.chunkEdit.root.children[1].weight, .5);
change("weight", "1.13", 1.13);
assert.equal(context.chunkEdit.root.children[1].children[0].weight, 1.15);
change("weight", "", NaN);
assert.equal(context.chunkEdit.root.children[1].children[0].weight, 1.15);
change("name", '<img src=x onerror="bad">');
vm.runInContext("renderChunkEditor()", context);
assert.ok(!host.innerHTML.includes("<img"));
console.log("PASS: nested artist replacement, parent weight preservation, weight grid, empty input, escaped names");
