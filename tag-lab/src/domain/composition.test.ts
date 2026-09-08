import assert from "node:assert/strict";
import test from "node:test";
import {
  countArtistLeaves,
  createArtist,
  createChunk,
  flattenComposition,
  forkCompositionFromPrompt,
  getEffectiveWeight,
  parseArtistPrompt,
  roundWeight,
  serializeArtistPrompt,
  updateNodeWeight,
} from "./composition";

const nestedComposition = createChunk(
  "root",
  "프롬프트",
  [
    createArtist("solo-a", "artist:a", 0.5),
    createChunk(
      "pair",
      "청크",
      [createArtist("nested-a", "a", 2), createArtist("nested-b", "b", -0.5)],
      3,
    ),
  ],
  2,
);

test("flattens nested weights and sums repeated artists", () => {
  assert.deepEqual(flattenComposition(nestedComposition), [
    { tag: "a", weight: 13, occurrences: 2 },
    { tag: "b", weight: -3, occurrences: 1 },
  ]);
});

test("reports effective node weights without flattening chunks", () => {
  assert.equal(getEffectiveWeight(nestedComposition, "pair"), 6);
  assert.equal(getEffectiveWeight(nestedComposition, "nested-b"), -3);
  assert.equal(getEffectiveWeight(nestedComposition, "missing"), null);
  assert.equal(countArtistLeaves(nestedComposition), 3);
});

test("updates one node immutably", () => {
  const updated = updateNodeWeight(nestedComposition, "pair", 4);
  assert.notEqual(updated, nestedComposition);
  assert.equal(getEffectiveWeight(updated, "nested-a"), 16);
  assert.equal(getEffectiveWeight(nestedComposition, "nested-a"), 12);
});

test("parses weighted artist tokens and preserves typed negatives", () => {
  assert.deepEqual(
    parseArtistPrompt("1girl, 2.5::artist:first_name::, -0.4::artist:second_name::"),
    [
      { tag: "first_name", weight: 2.5 },
      { tag: "second_name", weight: -0.4 },
    ],
  );
});

test("forks direct prompt edits without mutating the source chunk", () => {
  const source = createChunk("source", "검증된 청크", [createArtist("source-a", "a", 2)], 2);
  const fork = forkCompositionFromPrompt(
    source,
    "5::artist:a::, 0.75::artist:b::",
    "fork-1",
  );

  assert.equal(source.weight, 2);
  assert.equal(source.children[0].weight, 2);
  assert.equal(fork.weight, 1);
  assert.equal(fork.forkedFrom, "검증된 청크");
  assert.deepEqual(flattenComposition(fork), [
    { tag: "a", weight: 5, occurrences: 1 },
    { tag: "b", weight: 0.75, occurrences: 1 },
  ]);
});

test("serializes flattened artist weights using the v18 token shape", () => {
  assert.equal(serializeArtistPrompt(nestedComposition), "13::artist:a::, -3::artist:b::");
});

test("uses one rounding rule for prompt and visual projections", () => {
  const midpoint = createChunk(
    "midpoint",
    "반올림",
    [createArtist("base", "a", 2), createArtist("nested", "a", 0.275)],
  );

  assert.equal(roundWeight(flattenComposition(midpoint)[0].weight), 2.28);
  assert.equal(serializeArtistPrompt(midpoint), "2.28::artist:a::");
});
