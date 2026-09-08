import assert from "node:assert";
import {
  createUniquePresetNames,
  movePresetInQueue,
  resolveQueuedPresets,
  togglePresetInQueue,
} from "../../src/model/presetQueue";
import { DEFAULT_STATE } from "../../src/model/defaults";
import type { Preset } from "../../src/types/preset";

function runTests() {
  console.log("Running Preset Queue Tests...");

  assert.deepStrictEqual(
    createUniquePresetNames(
      ["sample.png", "sample.webp", ".png", "sample.png"],
      ["sample", "sample (2)"],
    ),
    ["sample (3)", "sample (4)", "Imported image", "sample (5)"],
  );

  assert.deepStrictEqual(togglePresetInQueue(["a", "b"], "a"), ["b"]);
  assert.deepStrictEqual(togglePresetInQueue(["a"], "b"), ["a", "b"]);
  assert.deepStrictEqual(movePresetInQueue(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepStrictEqual(movePresetInQueue(["a", "b", "c"], "a", -1), ["a", "b", "c"]);

  const presets: Preset[] = ["a", "b"].map((id) => ({
    id,
    name: id.toUpperCase(),
    state: structuredClone(DEFAULT_STATE),
    createdAt: 1,
  }));
  assert.deepStrictEqual(
    resolveQueuedPresets(["b", "missing", "a"], presets).map((preset) => preset.id),
    ["b", "a"],
  );

  console.log("Preset Queue Tests passed!");
}

runTests();
