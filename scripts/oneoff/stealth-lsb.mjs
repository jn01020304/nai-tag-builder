// 노드용 스텔스 LSB 디코더. src/utils/stealthLsbDecoder.ts 는 캔버스 의존이라 노드에서 못 쓴다.
// 외부 의존 없이 zlib 만으로 PNG 를 풀고 알파 채널 최하위 비트를 읽는다.

import zlib from "node:zlib";

const SIGNATURE = "stealth_pngcomp";
const SIG_BITS = [...SIGNATURE]
  .flatMap(ch => [...ch.charCodeAt(0).toString(2).padStart(8, "0")].map(Number));

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// RGBA/그레이+알파 8비트, 비인터레이스만 지원한다. 그 외는 null 로 물러난다
export function decodePngPixels(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  let p = 8, ihdr = null;
  const idat = [];
  while (p + 12 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    if (p + 12 + len > buf.length) break;
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      ihdr = {
        width: data.readUInt32BE(0), height: data.readUInt32BE(4),
        depth: data[8], colorType: data[9], interlace: data[12],
      };
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (!ihdr || ihdr.depth !== 8 || ihdr.interlace !== 0) return null;
  const channels = ihdr.colorType === 6 ? 4 : ihdr.colorType === 4 ? 2 : 0;
  if (!channels) return null; // 알파 없는 이미지엔 숨길 자리가 없다

  let raw;
  try { raw = zlib.inflateSync(Buffer.concat(idat)); } catch { return null; }

  const { width, height } = ihdr, bpp = channels, stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride); pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= bpp ? prev[i - bpp] : 0;
      const x = line[i];
      cur[i] = (filter === 0 ? x : filter === 1 ? x + a : filter === 2 ? x + b
        : filter === 3 ? x + ((a + b) >> 1) : x + paeth(a, b, c)) & 0xff;
    }
  }
  return { width, height, bpp, data: out };
}

function inflatePayload(bytes) {
  try { return zlib.gunzipSync(bytes); } catch { /* 아래로 */ }
  if (bytes.length > 18) {
    try { return zlib.inflateRawSync(bytes.subarray(10, bytes.length - 8)); } catch { /* 아래로 */ }
  }
  try { return zlib.inflateSync(bytes); } catch { return null; }
}

export function decodeStealthMetadata(buf) {
  const img = decodePngPixels(buf);
  if (!img) return null;
  const { width, height, bpp, data } = img;
  const alphaAt = (x, y) => data[y * width * bpp + x * bpp + (bpp - 1)] & 1;

  // 서명 -> 32비트 길이 -> 본문. 읽는 순서는 열 우선이다 (원본 디코더와 동일)
  let state = "sig", matched = 0, length = 0, lengthBits = 0;
  let bytes = null, index = 0, acc = 0, accBits = 0;

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const bit = alphaAt(x, y);
      if (state === "sig") {
        matched = bit === SIG_BITS[matched] ? matched + 1 : (bit === SIG_BITS[0] ? 1 : 0);
        if (matched === SIG_BITS.length) { state = "len"; length = 0; lengthBits = 0; }
        continue;
      }
      if (state === "len") {
        length = (length << 1) | bit;
        if (++lengthBits === 32) {
          const consumed = x * height + y + 1;
          if (length <= 0 || length % 8 !== 0 || length > width * height - consumed) return null;
          bytes = Buffer.alloc(length / 8);
          state = "data";
        }
        continue;
      }
      acc = (acc << 1) | bit;
      if (++accBits === 8) {
        bytes[index++] = acc; acc = 0; accBits = 0;
        if (index === bytes.length) {
          const out = inflatePayload(bytes);
          if (!out) return null;
          try { return JSON.parse(out.toString("utf8")); } catch { return null; }
        }
      }
    }
  }
  return null;
}
