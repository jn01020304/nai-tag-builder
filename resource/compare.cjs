const fs = require('fs');
const buf1 = fs.readFileSync('original.png');
const buf2 = fs.readFileSync('test-sample1.png');
console.log('original.png size:', buf1.length);
console.log('test-sample1.png size:', buf2.length);
let firstDiff = -1;
let diffCount = 0;
for (let i = 0; i < Math.min(buf1.length, buf2.length); i++) {
    if (buf1[i] !== buf2[i]) {
        if (firstDiff === -1) firstDiff = i;
        diffCount++;
    }
}
console.log('First byte difference at offset:', firstDiff);
console.log('Total differing bytes:', diffCount);
