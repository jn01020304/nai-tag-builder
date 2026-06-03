const fs = require("fs");

function extractPngMetadata(buffer) {
    const dataView = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
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

        // Chunk length (4 bytes)
        const chunkLength = dataView.getUint32(offset);
        offset += 4;

        // Chunk type (4 bytes)
        const typeString = String.fromCharCode(
            uint8View[offset],
            uint8View[offset + 1],
            uint8View[offset + 2],
            uint8View[offset + 3]
        );
        offset += 4;

        // Chunk data
        if (typeString === 'tEXt') {
            let keyword = '';
            let textStart = offset;

            // Read until null byte or end of chunk
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

        // Move past the data block and 4 bytes CRC
        offset += chunkLength + 4;
    }

    return metadata;
}

function parseNovelAIPng(buffer) {
    try {
        const meta = extractPngMetadata(buffer);

        // NovelAI stores JSON payload in the "Comment" tEXt chunk
        if (meta['Comment']) {
            return {
                data: JSON.parse(meta['Comment']),
                source: meta['Source']
            };
        }

        console.warn("No 'Comment' chunk found in PNG metadata.", meta);
        return null;
    } catch (e) {
        console.error("Failed to parse NovelAI PNG metadata:", e);
        return null;
    }
}


const buf = fs.readFileSync('resource/original.png');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

console.log("Parsing original.png...");
const res = parseNovelAIPng(ab);
if (res) {
  console.log("Parsed keys:", Object.keys(res.data));
  console.log("Source:", res.source);
} else {
  console.log("Parse returned null");
}
