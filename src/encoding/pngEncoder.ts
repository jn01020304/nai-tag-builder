import type { CommentJson } from '../types/metadata';

// ── CRC32 ────────────────────────────────────────────────

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[i] = c;
}

function crc32(buf: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG tEXt chunk ───────────────────────────────────────

function createTextChunk(key: string, text: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(key + '\0');
  const textBytes = new TextEncoder().encode(text);
  const data = new Uint8Array(keyBytes.length + textBytes.length);
  data.set(keyBytes, 0);
  data.set(textBytes, keyBytes.length);

  const lengthBytes = new Uint8Array(4);
  new DataView(lengthBytes.buffer).setUint32(0, data.length, false);

  const typeBytes = new TextEncoder().encode('tEXt');

  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  const crcValue = crc32(crcInput);
  const crcBytes = new Uint8Array(4);
  new DataView(crcBytes.buffer).setUint32(0, crcValue, false);

  const chunk = new Uint8Array(lengthBytes.length + typeBytes.length + data.length + crcBytes.length);
  chunk.set(lengthBytes, 0);
  chunk.set(typeBytes, lengthBytes.length);
  chunk.set(data, lengthBytes.length + typeBytes.length);
  chunk.set(crcBytes, lengthBytes.length + typeBytes.length + data.length);
  return chunk;
}

// ── stealth_pngcomp LSB encoding ─────────────────────────

async function gzipCompress(text: string): Promise<Uint8Array> {
  const inputBytes = new TextEncoder().encode(text);
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(inputBytes);
  writer.close();

  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) { result.set(c, off); off += c.length; }
  return result;
}

function bytesToBits(bytes: Uint8Array): number[] {
  const bits: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    for (let b = 7; b >= 0; b--) bits.push((bytes[i] >> b) & 1);
  }
  return bits;
}

async function buildStealthBitstream(jsonString: string): Promise<Uint8Array> {
  const sigBits = bytesToBits(new TextEncoder().encode('stealth_pngcomp'));
  const compressed = await gzipCompress(jsonString);
  const payloadBits = bytesToBits(compressed);

  const lenBits: number[] = [];
  const bitCount = payloadBits.length;
  for (let i = 31; i >= 0; i--) lenBits.push((bitCount >> i) & 1);

  const total = new Uint8Array(sigBits.length + lenBits.length + payloadBits.length);
  total.set(sigBits, 0);
  total.set(lenBits, sigBits.length);
  total.set(payloadBits, sigBits.length + lenBits.length);
  return total;
}

// ── Public API ───────────────────────────────────────────

export async function generatePngWithMetadata(comment: CommentJson): Promise<Blob> {
  const jsonString = JSON.stringify(comment);

  // 1. LSB bitstream
  const bitstream = await buildStealthBitstream(jsonString);

  // 2. Canvas size (enough pixels for all bits)
  let canvasSize = 64;
  while (canvasSize * canvasSize < bitstream.length) canvasSize *= 2;

  // 3. Canvas with LSB encoding
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d')!;

  const imageData = ctx.createImageData(canvasSize, canvasSize);
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] = 255;
    imageData.data[i + 1] = 255;
    imageData.data[i + 2] = 255;
    imageData.data[i + 3] = 255;
  }
  // Column-major alpha LSB
  for (let i = 0; i < bitstream.length; i++) {
    const col = Math.floor(i / canvasSize);
    const row = i % canvasSize;
    const alphaOffset = (row * canvasSize + col) * 4 + 3;
    imageData.data[alphaOffset] = (imageData.data[alphaOffset] & 0xFE) | bitstream[i];
  }
  ctx.putImageData(imageData, 0, 0);

  // 4. Canvas → PNG blob
  const lsbBlob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject('toBlob failed'), 'image/png');
  });

  // 5. Insert tEXt chunks after PNG sig(8) + IHDR(25)
  const pngBytes = new Uint8Array(await lsbBlob.arrayBuffer());
  const insertOffset = 33;

  const allChunks = [
    createTextChunk('Title', 'NovelAI generated image'),
    createTextChunk('Description', comment.prompt),
    createTextChunk('Software', 'NovelAI'),
    createTextChunk('Source', 'NovelAI Diffusion V4.5 4BDE2A90'),
    createTextChunk('Generation time', '0.0'),
    createTextChunk('Comment', jsonString),
  ];
  const totalChunkSize = allChunks.reduce((s, c) => s + c.length, 0);

  const finalPng = new Uint8Array(pngBytes.length + totalChunkSize);
  finalPng.set(pngBytes.slice(0, insertOffset), 0);
  let offset = insertOffset;
  for (const chunk of allChunks) {
    finalPng.set(chunk, offset);
    offset += chunk.length;
  }
  finalPng.set(pngBytes.slice(insertOffset), offset);

  return new Blob([finalPng], { type: 'image/png' });
}
