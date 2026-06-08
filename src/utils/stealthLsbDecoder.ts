import { inflateRaw, ungzip } from "pako";

const STEALTH_SIGNATURE = "stealth_pngcomp";
const STEALTH_SIGNATURE_BITS = STEALTH_SIGNATURE
  .split("")
  .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
  .join("");

function canDecodePixels(): boolean {
  return typeof createImageBitmap === "function" && (
    typeof OffscreenCanvas !== "undefined" ||
    typeof document !== "undefined"
  );
}

function inflateStealthPayload(dataBytes: Uint8Array): Uint8Array {
  if (dataBytes.length > 18) {
    try {
      return inflateRaw(dataBytes.slice(10, dataBytes.length - 8));
    } catch {
      return ungzip(dataBytes);
    }
  }

  return ungzip(dataBytes);
}

function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export async function decodeStealthMetadataFromImage(blob: Blob): Promise<unknown | null> {
  if (!canDecodePixels()) return null;

  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, width, height).data;

    let state: "signature" | "length" | "data" = "signature";
    let signatureWindow = "";
    let length = 0;
    let lengthBits = 0;
    let dataLength = 0;
    let dataBytes: Uint8Array | null = null;
    let dataIndex = 0;
    let byteValue = 0;
    let byteBits = 0;

    for (let x = 0; x < width; x += 1) {
      for (let y = 0; y < height; y += 1) {
        const alphaIndex = (y * width + x) * 4 + 3;
        const bit = pixels[alphaIndex] & 1;

        if (state === "signature") {
          signatureWindow += String(bit);
          if (signatureWindow.length > STEALTH_SIGNATURE_BITS.length) {
            signatureWindow = signatureWindow.slice(1);
          }
          if (signatureWindow === STEALTH_SIGNATURE_BITS) {
            state = "length";
            length = 0;
            lengthBits = 0;
          }
          continue;
        }

        if (state === "length") {
          length = (length << 1) | bit;
          lengthBits += 1;
          if (lengthBits === 32) {
            if (length <= 0 || length * 8 > width * height) {
              return null;
            }
            dataLength = length;
            dataBytes = new Uint8Array(dataLength);
            state = "data";
          }
          continue;
        }

        byteValue = (byteValue << 1) | bit;
        byteBits += 1;
        if (byteBits === 8 && dataBytes) {
          dataBytes[dataIndex] = byteValue;
          dataIndex += 1;
          byteValue = 0;
          byteBits = 0;
          if (dataIndex === dataLength) {
            const decompressed = inflateStealthPayload(dataBytes);
            const text = new TextDecoder("utf-8", { fatal: true }).decode(decompressed);
            return JSON.parse(text) as unknown;
          }
        }
      }
    }
  } catch (error) {
    console.warn("Failed to decode stealth metadata:", error);
    return null;
  } finally {
    bitmap?.close();
  }

  return null;
}
