const fs = require('fs');
const { TextDecoder, TextEncoder } = require('util');

// Mock defaults
const DEFAULT_STATE = { basePrompt: 'default prompt', steps: 28, characters: [], negativeCharacters: [] };

function extractPngMetadata(buffer) {
    const dataView = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);

    const signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < signature.length; i++) {
        if (uint8View[i] !== signature[i]) {
            console.warn("Invalid PNG file or signature mismatch.");
            return {};
        }
    }

    const metadata = {};
    let offset = 8;
    const length = uint8View.length;
    const textDecoder = new TextDecoder();

    while (offset < length) {
        if (offset + 8 > length) break;
        const chunkLength = dataView.getUint32(offset);
        offset += 4;
        const typeString = String.fromCharCode(
            uint8View[offset], uint8View[offset + 1], uint8View[offset + 2], uint8View[offset + 3]
        );
        offset += 4;

        if (typeString === 'tEXt') {
            let keyword = '';
            let textStart = offset;
            for (let i = offset; i < offset + chunkLength; i++) {
                if (uint8View[i] === 0) {
                    keyword = textDecoder.decode(uint8View.slice(offset, i));
                    textStart = i + 1;
                    break;
                }
            }
            if (keyword) {
                const text = textDecoder.decode(uint8View.slice(textStart, offset + chunkLength));
                metadata[keyword] = text;
            }
        }
        offset += chunkLength + 4;
    }
    return metadata;
}

function parseNovelAIPng(buffer) {
    try {
        const meta = extractPngMetadata(buffer);
        console.log("Extracted Meta Keys:", Object.keys(meta));
        if (meta['Comment']) {
            return {
                data: JSON.parse(meta['Comment']),
                source: meta['Source']
            };
        }
        return null;
    } catch (e) {
        console.error("Failed to parse", e);
        return null;
    }
}

function translateNovelAiMetadata(data, source) {
    const state = { ...DEFAULT_STATE };
    if (!data) return state;
    if (source) state.source = source;

    if (data.v4_prompt?.caption) {
        state.basePrompt = data.v4_prompt.caption.base_caption || '';
    } else if (typeof data.prompt === 'string') {
        state.basePrompt = data.prompt;
    }

    if (typeof data.steps === 'number') state.steps = data.steps;

    return state;
}

// Create a dummy metadata buffer
const textEncoder = new TextEncoder();
const commentJson = JSON.stringify({ "prompt": "my imported prompt", "steps": 50 });
const keyBytes = textEncoder.encode("Comment\\0");
const textBytes = textEncoder.encode(commentJson);
const chunkData = new Uint8Array(keyBytes.length + textBytes.length);
chunkData.set(keyBytes, 0);
chunkData.set(textBytes, keyBytes.length);

const chunkLenBytes = new Uint8Array(4);
new DataView(chunkLenBytes.buffer).setUint32(0, chunkData.length);
const typeBytes = textEncoder.encode("tEXt");

const sigBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const crcBytes = new Uint8Array([0, 0, 0, 0]);

const buffer = new Uint8Array(sigBytes.length + chunkLenBytes.length + typeBytes.length + chunkData.length + crcBytes.length);
buffer.set(sigBytes, 0);
buffer.set(chunkLenBytes, sigBytes.length);
buffer.set(typeBytes, sigBytes.length + 4);
buffer.set(chunkData, sigBytes.length + 8);
buffer.set(crcBytes, buffer.length - 4);

console.log("Testing with mock PNG data...");
const jsonMeta = parseNovelAIPng(buffer.buffer);
console.log("Parsed JSON:", jsonMeta);

if (jsonMeta) {
    const state = translateNovelAiMetadata(jsonMeta.data, jsonMeta.source);
    console.log("Translated State:", state);
}
