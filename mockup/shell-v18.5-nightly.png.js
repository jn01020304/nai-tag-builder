const pngMetadata = (() => {
function readUint32BE(view, offset) {
  return view.getUint32(offset, false);
}
function latin1(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}
async function inflateBytes(bytes, format = "deflate") {
  if (typeof DecompressionStream !== "function")
    throw new Error("이 브라우저는 압축 PNG metadata 해제를 지원하지 않습니다.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function parsePngTextChunks(buffer) {
  const bytes = new Uint8Array(buffer);
  const signature = [137,80,78,71,13,10,26,10];
  if (bytes.length < 8 || signature.some((value, index) => bytes[index] !== value))
    throw new Error("PNG 파일이 아닙니다.");
  const view = new DataView(buffer);
  const decoder = new TextDecoder("utf-8");
  const metadata = {};
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32BE(view, offset);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const start = offset + 8, end = start + length;
    if (end + 4 > bytes.length) break;
    const data = bytes.subarray(start, end);
    if (type === "tEXt") {
      const zero = data.indexOf(0);
      if (zero > 0) metadata[latin1(data.subarray(0, zero))] = latin1(data.subarray(zero + 1));
    }
    else if (type === "zTXt") {
      const zero = data.indexOf(0);
      if (zero > 0 && data[zero + 1] === 0) {
        try { metadata[latin1(data.subarray(0, zero))] = latin1(await inflateBytes(data.subarray(zero + 2))); } catch {}
      }
    }
    else if (type === "iTXt") {
      const zero = data.indexOf(0);
      if (zero > 0 && zero + 3 < data.length) {
        const key = latin1(data.subarray(0, zero));
        const compressed = data[zero + 1] === 1;
        let cursor = zero + 3;
        const languageEnd = data.indexOf(0, cursor);
        if (languageEnd >= 0) {
          cursor = languageEnd + 1;
          const translatedEnd = data.indexOf(0, cursor);
          if (translatedEnd >= 0) {
            cursor = translatedEnd + 1;
            try {
              const content = compressed ? await inflateBytes(data.subarray(cursor)) : data.subarray(cursor);
              metadata[key] = decoder.decode(content);
            } catch {}
          }
        }
      }
    }
    offset = end + 4;
    if (type === "IEND") break;
  }
  return metadata;
}
function byteFromAlpha(data, width, height, byteIndex) {
  let value = 0;
  for (let bit = 0; bit < 8; bit++) {
    const position = byteIndex * 8 + bit;
    const x = Math.floor(position / height);
    const y = position % height;
    if (x >= width) return null;
    value = (value << 1) | (data[(y * width + x) * 4 + 3] & 1);
  }
  return value;
}
async function extractStealthPngMetadata(file) {
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { return null; }
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const magic = "stealth_pngcomp";
  let cursor = 0, found = "";
  for (let i = 0; i < magic.length; i++) {
    const byte = byteFromAlpha(pixels, canvas.width, canvas.height, cursor++);
    if (byte == null) return null;
    found += String.fromCharCode(byte);
  }
  if (found !== magic)
    return null;
  let bitLength = 0;
  for (let i = 0; i < 4; i++) {
    const byte = byteFromAlpha(pixels, canvas.width, canvas.height, cursor++);
    if (byte == null) return null;
    bitLength = bitLength * 256 + byte;
  }
  const byteLength = Math.floor(bitLength / 8);
  if (byteLength <= 0 || byteLength > 32 * 1024 * 1024)
    return null;
  const packed = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    const byte = byteFromAlpha(pixels, canvas.width, canvas.height, cursor++);
    if (byte == null) return null;
    packed[i] = byte;
  }
  try {
    const unpacked = await inflateBytes(packed, "gzip");
    return JSON.parse(new TextDecoder().decode(unpacked));
  } catch {
    return null;
  }
}
return { parsePngTextChunks, extractStealthPngMetadata };
})();
