const fs = require('fs');

// Simple mock for browser APIs
global.TextDecoder = require('util').TextDecoder;

const code = fs.readFileSync('src/utils/pngParser.ts', 'utf8')
    // Strip exports
    .replace(/export /g, '');

const testScript = code + `

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
`;

fs.writeFileSync('test-parse.js', testScript);
console.log("Test script created.");
