const fs = require('fs');

const buffer = fs.readFileSync('resource/original.png');
const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
const uint8View = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

let offset = 8;
const chunks = {};
while (offset < uint8View.length) {
    if (offset + 8 > uint8View.length) break;
    const chunkLength = dataView.getUint32(offset);
    offset += 4;
    const typeString = String.fromCharCode(uint8View[offset], uint8View[offset + 1], uint8View[offset + 2], uint8View[offset + 3]);
    offset += 4;

    if (typeString === 'tEXt') {
        let keyword = '';
        let textStart = offset;
        for (let i = offset; i < offset + chunkLength; i++) {
            if (uint8View[i] === 0) {
                keyword = new TextDecoder().decode(uint8View.slice(offset, i));
                textStart = i + 1;
                break;
            }
        }
        if (keyword) {
            chunks[keyword] = new TextDecoder().decode(uint8View.slice(textStart, offset + chunkLength));
        }
    }
    offset += chunkLength + 4;
}

console.log('Keys:', Object.keys(chunks));
console.log('Source:', chunks['Source']);
if (chunks['Comment']) {
    try {
        const json = JSON.parse(chunks['Comment']);
        console.log('Comment parsed OK');
    } catch (e) {
        console.log('Comment parse error', e);
    }
} else {
    console.log('No Comment chunk');
}
