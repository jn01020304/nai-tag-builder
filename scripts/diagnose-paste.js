// ============================================================
// Paste Byte-Fidelity Diagnostic
// NovelAI 페이지 콘솔에서 실행하세요.
// 목적: DataTransfer를 거친 PNG 바이트가 원본과 동일한지 검증
// ============================================================
(async () => {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────

  function createTextChunk(key, text) {
    const enc = new TextEncoder();
    const keyBytes = enc.encode(key + '\0');
    const textBytes = enc.encode(text);
    const data = new Uint8Array(keyBytes.length + textBytes.length);
    data.set(keyBytes, 0);
    data.set(textBytes, keyBytes.length);

    const lengthBytes = new Uint8Array(4);
    new DataView(lengthBytes.buffer).setUint32(0, data.length, false);

    const typeBytes = enc.encode('tEXt');

    const crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[i] = c;
    }
    function crc32(buf) {
      let c = 0xFFFFFFFF;
      for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
      return (c ^ 0xFFFFFFFF) >>> 0;
    }

    const crcInput = new Uint8Array(typeBytes.length + data.length);
    crcInput.set(typeBytes, 0);
    crcInput.set(data, typeBytes.length);
    const crcValue = crc32(crcInput);
    const crcBytes = new Uint8Array(4);
    new DataView(crcBytes.buffer).setUint32(0, crcValue, false);

    const chunk = new Uint8Array(4 + 4 + data.length + 4);
    chunk.set(lengthBytes, 0);
    chunk.set(typeBytes, 4);
    chunk.set(data, 8);
    chunk.set(crcBytes, 8 + data.length);
    return chunk;
  }

  // PNG 바이트에서 tEXt 청크를 모두 찾아 반환
  function scanTextChunks(bytes) {
    const chunks = [];
    const dec = new TextDecoder();
    let pos = 8; // PNG signature 이후
    while (pos + 8 <= bytes.length) {
      const len = new DataView(bytes.buffer, bytes.byteOffset + pos, 4).getUint32(0, false);
      const type = dec.decode(bytes.slice(pos + 4, pos + 8));
      if (type === 'tEXt') {
        const body = bytes.slice(pos + 8, pos + 8 + len);
        const nullIdx = body.indexOf(0);
        const key = dec.decode(body.slice(0, nullIdx));
        const value = dec.decode(body.slice(nullIdx + 1));
        chunks.push({ key, value, offset: pos, totalSize: 12 + len });
      }
      if (type === 'IEND') break;
      pos += 12 + len; // length(4) + type(4) + data(len) + crc(4)
    }
    return chunks;
  }

  // 두 Uint8Array를 byte-by-byte 비교
  function bytesEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // ── Step 1: 테스트 PNG 생성 ─────────────────────────────

  console.log('🔬 [1/4] 테스트 PNG 생성 중...');

  const testPayload = JSON.stringify({
    prompt: 'diagnostic test',
    steps: 28,
    scale: 5,
    width: 832,
    height: 1216,
    v4_prompt: {
      caption: { base_caption: 'diagnostic test', char_captions: [] },
      use_coords: false,
      use_order: true
    }
  });

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  const basePngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const basePngBytes = new Uint8Array(await basePngBlob.arrayBuffer());

  // IHDR 직후 (byte 33)에 tEXt 청크 삽입
  const commentChunk = createTextChunk('Comment', testPayload);
  const insertOffset = 33;

  const originalBytes = new Uint8Array(basePngBytes.length + commentChunk.length);
  originalBytes.set(basePngBytes.slice(0, insertOffset), 0);
  originalBytes.set(commentChunk, insertOffset);
  originalBytes.set(basePngBytes.slice(insertOffset), insertOffset + commentChunk.length);

  // ── Step 2: 원본 분석 ──────────────────────────────────

  console.log('🔬 [2/4] 원본 분석 중...');

  const originalChunks = scanTextChunks(originalBytes);
  console.log(`   원본 크기: ${originalBytes.length} bytes`);
  console.log(`   tEXt 청크 ${originalChunks.length}개:`, originalChunks.map(c => c.key));

  // ── Step 3: paste 리스너 등록 ──────────────────────────

  console.log('🔬 [3/4] paste 리스너 등록 중...');

  const resultPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      document.body.removeEventListener('paste', handler, true);
      resolve({ error: 'TIMEOUT — paste 이벤트가 리스너에 도달하지 않았습니다.' });
    }, 5000);

    function handler(e) {
      clearTimeout(timeout);
      document.body.removeEventListener('paste', handler, true);

      const files = e.clipboardData && e.clipboardData.files;
      if (!files || files.length === 0) {
        resolve({ error: 'paste 이벤트에 파일이 없습니다.' });
        return;
      }

      const file = files[0];
      file.arrayBuffer().then(buf => {
        const receivedBytes = new Uint8Array(buf);
        const receivedChunks = scanTextChunks(receivedBytes);
        const identical = bytesEqual(originalBytes, receivedBytes);
        resolve({ receivedBytes, receivedChunks, identical });
      });
    }

    // capture phase로 등록 — NovelAI 리스너보다 먼저 실행
    document.body.addEventListener('paste', handler, true);
  });

  // ── Step 4: 프로그래밍적 paste 발생 ────────────────────

  console.log('🔬 [4/4] paste 이벤트 발생 중...');

  const file = new File([originalBytes], 'diagnostic.png', { type: 'image/png' });
  const dt = new DataTransfer();
  dt.items.add(file);

  const pasteEvent = new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: dt
  });
  document.body.dispatchEvent(pasteEvent);

  // ── 결과 출력 ──────────────────────────────────────────

  const result = await resultPromise;

  console.log('\n');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Paste Byte-Fidelity Test Result        ║');
  console.log('╠══════════════════════════════════════════╣');

  if (result.error) {
    console.log(`║ ❌ ERROR: ${result.error}`);
    console.log('╚══════════════════════════════════════════╝');
    return;
  }

  const { receivedBytes, receivedChunks, identical } = result;

  console.log(`║ Original : ${originalBytes.length} bytes, tEXt: ${originalChunks.length} (${originalChunks.map(c => c.key).join(', ')})`);
  console.log(`║ Received : ${receivedBytes.length} bytes, tEXt: ${receivedChunks.length} (${receivedChunks.map(c => c.key).join(', ') || 'none'})`);
  console.log('║');

  if (identical) {
    console.log('║ ✅ IDENTICAL — 바이트 완전 일치');
    console.log('║');
    console.log('║ → 원인 2번: NovelAI paste 파서가 tEXt를 안 읽음');
    console.log('║   paste 경로에서 LSB만 읽거나 다른 로직을 사용.');
    console.log('║   LSB 인코딩으로 전환하면 paste 경로가 살아날 가능성 있음.');
  } else {
    console.log('║ ❌ DIFFERENT — 바이트 불일치');
    console.log(`║   크기 차이: ${originalBytes.length} → ${receivedBytes.length} (${receivedBytes.length - originalBytes.length})`);
    if (receivedChunks.length === 0) {
      console.log('║   tEXt 청크가 완전히 사라짐');
    }
    console.log('║');
    console.log('║ → 원인 1번: 브라우저가 DataTransfer 내 PNG를 재인코딩');
    console.log('║   paste 경로에서 tEXt를 쓸 수 없음.');
    console.log('║   LSB 인코딩 또는 fallback(다운로드+업로드) 필요.');
  }

  console.log('╚══════════════════════════════════════════╝');
})();
