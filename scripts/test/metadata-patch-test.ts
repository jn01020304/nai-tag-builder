import assert from "node:assert";
import { DEFAULT_STATE } from "../../src/model/defaults";
import {
  mergeMetadataPatch,
  type MetadataPatch,
} from "../../src/model/metadataPatch";

function createCurrentState() {
  return structuredClone(DEFAULT_STATE);
}

function runTests() {
  console.log("Running Metadata Patch Tests...");

  {
    const current = createCurrentState();
    const patch: MetadataPatch = {
      params: { seed: 4242 },
    };
    const merged = mergeMetadataPatch(current, patch);

    assert.strictEqual(merged.params.seed, 4242);
    assert.deepStrictEqual(merged.prompt, current.prompt);
    assert.strictEqual(merged.params.width, current.params.width);
    assert.deepStrictEqual(merged.advanced, current.advanced);
  }

  {
    const current = createCurrentState();
    const merged = mergeMetadataPatch(current, {
      prompt: {
        characters: [],
        negativeCharacters: [],
      },
    });

    assert.deepStrictEqual(merged.prompt.characters, []);
    assert.deepStrictEqual(merged.prompt.negativeCharacters, []);
    assert.strictEqual(merged.prompt.basePrompt, current.prompt.basePrompt);
  }

  {
    const current = createCurrentState();
    current.prompt.negativeCharacters[0].caption = "preserved negative";
    const merged = mergeMetadataPatch(current, {
      prompt: {
        characters: [{
          id: "imported-character",
          caption: "imported positive",
          centerX: 0.25,
          centerY: 0.75,
        }],
      },
    });

    assert.strictEqual(
      merged.prompt.negativeCharacters[0].caption,
      "preserved negative",
    );
    assert.strictEqual(
      merged.prompt.characters[0].id,
      merged.prompt.negativeCharacters[0].id,
    );
  }

  {
    const current = createCurrentState();
    const merged = mergeMetadataPatch(current, {
      prompt: {
        characters: [{
          id: "second",
          caption: "second positive",
          centerX: 0.5,
          centerY: 0.5,
        }],
        negativeCharacters: [
          {
            id: "first",
            caption: "first negative",
            centerX: 0.5,
            centerY: 0.5,
          },
          {
            id: "second",
            caption: "second negative",
            centerX: 0.5,
            centerY: 0.5,
          },
        ],
      },
    });

    assert.deepStrictEqual(
      merged.prompt.characters.map((character) => character.id),
      ["second", "first"],
    );
    assert.deepStrictEqual(
      merged.prompt.negativeCharacters.map((character) => character.caption),
      ["second negative", "first negative"],
    );
  }

  console.log("Metadata Patch Tests passed!");
}

runTests();
