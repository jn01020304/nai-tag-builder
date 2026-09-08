import assert from "node:assert";
import {
  extractPngMetadata,
  parseNovelAIImageFiles,
} from "../../src/utils/pngParser";

const PNG_SIGNATURE = [
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
];

function createChunk(type: string, data: Uint8Array): number[] {
  const length = data.length;
  return [
    (length >>> 24) & 255,
    (length >>> 16) & 255,
    (length >>> 8) & 255,
    length & 255,
    ...Array.from(type, (character) => character.charCodeAt(0)),
    ...data,
    0,
    0,
    0,
    0,
  ];
}

function encodeTextChunk(keyword: string, text: string): Uint8Array {
  return new Uint8Array([
    ...new TextEncoder().encode(keyword),
    0,
    ...new TextEncoder().encode(text),
  ]);
}

function createPngBytes(chunks: number[][]): Uint8Array {
  return new Uint8Array([
    ...PNG_SIGNATURE,
    ...chunks.flat(),
  ]);
}

function createNamedBlob(name: string, bytes: Uint8Array): File {
  const blob = new Blob([bytes], { type: "image/png" }) as File;
  Object.defineProperty(blob, "name", { value: name });
  return blob;
}

async function runTests() {
  console.log("Running PNG Parser Tests...");

  {
    const corruptCompressedChunk = createChunk(
      "zTXt",
      new Uint8Array([
        ...new TextEncoder().encode("Broken"),
        0,
        0,
        1,
        2,
        3,
      ]),
    );
    const validComment = JSON.stringify({
      prompt: "valid after corrupt chunk",
      seed: 123,
    });
    const bytes = createPngBytes([
      corruptCompressedChunk,
      createChunk("tEXt", encodeTextChunk("Comment", validComment)),
    ]);

    assert.strictEqual(
      extractPngMetadata(bytes.buffer).Comment,
      validComment,
    );
  }

  {
    const oversizedChunk = new Uint8Array([
      ...PNG_SIGNATURE,
      0,
      0,
      16,
      0,
      0x74,
      0x45,
      0x58,
      0x74,
      1,
      2,
      3,
      4,
    ]);
    assert.deepStrictEqual(extractPngMetadata(oversizedChunk.buffer), {});
  }

  {
    const rejectedFile = {
      name: "rejected.png",
      arrayBuffer: async () => {
        throw new Error("read failed");
      },
    } as File;
    const validFile = createNamedBlob(
      "valid.png",
      createPngBytes([
        createChunk(
          "tEXt",
          encodeTextChunk("Comment", JSON.stringify({
            prompt: "batch survives",
            seed: 456,
          })),
        ),
      ]),
    );
    const result = await parseNovelAIImageFiles([
      rejectedFile,
      validFile,
    ]);

    assert.strictEqual(result.patches.length, 1);
    assert.strictEqual(result.patches[0].fileName, "valid.png");
    assert.deepStrictEqual(result.failedFiles, ["rejected.png"]);
    assert.strictEqual(
      result.mergedState?.prompt.basePrompt,
      "batch survives",
    );
  }

  console.log("PNG Parser Tests passed!");
}

await runTests();
