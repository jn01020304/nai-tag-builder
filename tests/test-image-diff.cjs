const fs = require('fs');

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
                metadata[keyword] = textDecoder.decode(uint8View.slice(textStart, offset + chunkLength));
            }
        }
        offset += chunkLength + 4;
    }
    return metadata;
}

const origBuffer = fs.readFileSync('./resource/original.png');
const origMeta = extractPngMetadata(origBuffer.buffer);

const testBuffer = fs.readFileSync('./resource/test.png');
const testMeta = extractPngMetadata(testBuffer.buffer);

console.log('--- ORIGINAL METADATA ALONE ---');
console.log('original keys: ' + Object.keys(origMeta).join(', '));
if (origMeta['Comment']) {
    const commentData = JSON.parse(origMeta['Comment']);
    console.log('original Comment JSON keys: ' + Object.keys(commentData).join(', '));
    console.log('original comment.prompt:', !!commentData.prompt);
    console.log('original comment.v4_prompt:', !!commentData.v4_prompt);
}
console.log('original Description:', !!origMeta['Description']);
console.log('original Source:', origMeta['Source']);


console.log('\n--- TEST METADATA ALONE ---');
console.log('test keys: ' + Object.keys(testMeta).join(', '));
if (testMeta['Comment']) {
    const commentData = JSON.parse(testMeta['Comment']);
    console.log('test Comment JSON keys: ' + Object.keys(commentData).join(', '));
    console.log('test comment.prompt:', !!commentData.prompt);
    console.log('test comment.v4_prompt:', !!commentData.v4_prompt);
}
console.log('test Description:', !!testMeta['Description']);
console.log('test Source:', testMeta['Source']);

