import fs from 'fs';
import extract from 'png-chunks-extract';
import text from 'png-chunk-text';

function extractTextChunks(filePath) {
    const buffer = fs.readFileSync(filePath);
    const chunks = extract(buffer);

    const textChunks = {};
    for (const chunk of chunks) {
        if (chunk.name === 'tEXt') {
            const { keyword, text: value } = text.decode(chunk.data);
            textChunks[keyword] = value;
        }
    }
    return textChunks;
}

const originalChunks = extractTextChunks('resource/original.png');
const sampleChunks = extractTextChunks('resource/test-sample1.png');

fs.writeFileSync('resource/original-metadata.json', JSON.stringify(originalChunks, null, 2));
fs.writeFileSync('resource/test-sample-metadata.json', JSON.stringify(sampleChunks, null, 2));
console.log('Extract done');
