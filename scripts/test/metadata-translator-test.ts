import assert from "node:assert";
import {
  DEFAULT_STATE,
  normalizeMetadataState,
} from "../../src/model/defaults";
import { translateNovelAiMetadata } from "../../src/utils/metadataTranslator";

function createCharacter(caption: string, x: number, y: number) {
  return {
    char_caption: caption,
    centers: [{ x, y }],
  };
}

function runTests() {
  console.log("Running Metadata Translator Tests...");

  const state = translateNovelAiMetadata({
    v4_prompt: {
      caption: {
        base_caption: "positive",
        char_captions: [
          createCharacter("positive character", 0.25, 0.75),
        ],
      },
      use_coords: true,
      use_order: true,
    },
    v4_negative_prompt: {
      caption: {
        base_caption: "negative",
        char_captions: [
          createCharacter("negative character", 0.25, 0.75),
        ],
      },
    },
  });

  assert.strictEqual(state.prompt.characters.length, 1);
  assert.strictEqual(state.prompt.negativeCharacters.length, 1);
  assert.strictEqual(
    state.prompt.characters[0].id,
    state.prompt.negativeCharacters[0].id,
  );

  const mismatched = translateNovelAiMetadata({
    v4_prompt: {
      caption: {
        base_caption: "positive",
        char_captions: [
          createCharacter("first", 0.2, 0.3),
          createCharacter("second", 0.7, 0.8),
        ],
      },
      use_coords: true,
      use_order: true,
    },
    v4_negative_prompt: {
      caption: {
        base_caption: "negative",
        char_captions: [
          createCharacter("first negative", 0.2, 0.3),
        ],
      },
    },
  });

  assert.strictEqual(mismatched.prompt.characters.length, 2);
  assert.strictEqual(mismatched.prompt.negativeCharacters.length, 2);
  assert.deepStrictEqual(
    mismatched.prompt.characters.map((character) => character.id),
    mismatched.prompt.negativeCharacters.map((character) => character.id),
  );
  assert.strictEqual(mismatched.prompt.negativeCharacters[1].caption, "");

  const persisted = structuredClone(DEFAULT_STATE);
  persisted.prompt.characters[0].id = "positive-id";
  persisted.prompt.negativeCharacters[0].id = "negative-id";
  const normalized = normalizeMetadataState(persisted);

  assert.strictEqual(normalized.prompt.characters[0].id, "positive-id");
  assert.strictEqual(
    normalized.prompt.characters[0].id,
    normalized.prompt.negativeCharacters[0].id,
  );

  const withoutCharacters = translateNovelAiMetadata({
    v4_prompt: {
      caption: {
        base_caption: "no characters",
      },
    },
  });
  assert.deepStrictEqual(withoutCharacters.prompt.characters, []);
  assert.deepStrictEqual(withoutCharacters.prompt.negativeCharacters, []);

  console.log("Metadata Translator Tests passed!");
}

runTests();
