// ============================================================
// LSB Paste Diagnostic (stealth_pngcomp)
// NovelAI 페이지 콘솔에서 실행하세요.
// 목적: alpha LSB로 인코딩한 PNG가 paste 경로에서 인식되는지 검증
// ============================================================
(async () => {
  'use strict';

  // ── gzip 압축 (CompressionStream API) ───────────────────

  async function gzipCompress(text) {
    const inputBytes = new TextEncoder().encode(text);
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(inputBytes);
    writer.close();

    const reader = cs.readable.getReader();
    const chunks = [];
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

  // ── 비트 변환 ──────────────────────────────────────────

  // byte → 8비트 배열 (MSB-first)
  function byteToBits(byte) {
    const bits = [];
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
    return bits;
  }

  // Uint8Array → 비트 배열
  function bytesToBits(bytes) {
    const bits = [];
    for (let i = 0; i < bytes.length; i++) {
      for (let b = 7; b >= 0; b--) bits.push((bytes[i] >> b) & 1);
    }
    return bits;
  }

  // ── bitstream 구성 ─────────────────────────────────────

  async function buildBitstream(jsonString) {
    // 1. Signature: "stealth_pngcomp" → UTF-8 → bits
    const sigBytes = new TextEncoder().encode('stealth_pngcomp');
    const sigBits = bytesToBits(sigBytes); // 120 bits

    // 2. Payload: gzip 압축
    const compressed = await gzipCompress(jsonString);
    const payloadBits = bytesToBits(compressed);

    // 3. Length: payload 비트 수 → 32비트 big-endian
    const lenBits = [];
    const bitCount = payloadBits.length;
    for (let i = 31; i >= 0; i--) lenBits.push((bitCount >> i) & 1);

    // 4. 결합: signature + length + payload
    const total = new Uint8Array(sigBits.length + lenBits.length + payloadBits.length);
    total.set(sigBits, 0);
    total.set(lenBits, sigBits.length);
    total.set(payloadBits, sigBits.length + lenBits.length);
    return total;
  }

  // ── LSB PNG 생성 ───────────────────────────────────────

  async function encodeLsbPng(bitstream, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 전체를 불투명 흰색으로 초기화
    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i]     = 255; // R
      imageData.data[i + 1] = 255; // G
      imageData.data[i + 2] = 255; // B
      imageData.data[i + 3] = 255; // A
    }

    // column-major 순서로 alpha LSB에 비트 기록
    for (let i = 0; i < bitstream.length; i++) {
      const col = Math.floor(i / height);
      const row = i % height;
      const pixelIndex = row * width + col;
      const alphaOffset = pixelIndex * 4 + 3;
      imageData.data[alphaOffset] = (imageData.data[alphaOffset] & 0xFE) | bitstream[i];
    }

    ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob failed'));
      }, 'image/png');
    });
  }

  // ── alpha LSB 읽기 (검증용) ────────────────────────────

  async function readAlphaLsb(pngBlob, count) {
    const bitmap = await createImageBitmap(pngBlob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const bits = [];
    for (let i = 0; i < count && i < canvas.width * canvas.height; i++) {
      const col = Math.floor(i / canvas.height);
      const row = i % canvas.height;
      const pixelIndex = row * canvas.width + col;
      const alpha = imageData.data[pixelIndex * 4 + 3];
      bits.push(alpha & 1);
    }
    return bits;
  }

  // ── Main ───────────────────────────────────────────────

  console.log('🔬 [1/5] 메타데이터 JSON 구성 중...');

  const testPayload = {
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
  };
  const jsonString = JSON.stringify(testPayload);
  console.log('   JSON length:', jsonString.length, 'chars');

  console.log('🔬 [2/5] stealth_pngcomp bitstream 생성 중...');

  const bitstream = await buildBitstream(jsonString);
  console.log('   Total bits:', bitstream.length,
    `(sig:120 + len:32 + payload:${bitstream.length - 152})`);

  // canvas 크기 계산
  let canvasSize = 64;
  while (canvasSize * canvasSize < bitstream.length) canvasSize *= 2;
  console.log(`   Canvas: ${canvasSize}x${canvasSize} (${canvasSize * canvasSize} pixels available)`);

  console.log('🔬 [3/5] LSB PNG 생성 중...');

  const pngBlob = await encodeLsbPng(bitstream, canvasSize, canvasSize);
  console.log('   PNG blob size:', pngBlob.size, 'bytes');

  // 생성 직후 self-verify: 방금 만든 PNG의 alpha LSB를 다시 읽어 원본 bitstream과 비교
  const selfCheckBits = await readAlphaLsb(pngBlob, bitstream.length);
  let selfMatch = true;
  for (let i = 0; i < bitstream.length; i++) {
    if (bitstream[i] !== selfCheckBits[i]) { selfMatch = false; break; }
  }
  console.log('   Self-check (encode→decode 일치):', selfMatch ? '✅ PASS' : '❌ FAIL');
  if (!selfMatch) {
    console.log('   ⚠️ 인코딩 자체에 문제 — premultiplied alpha 손실 가능성');
    console.log('╚══════════════════════════════════════════╝');
    return;
  }

  console.log('🔬 [4/5] paste 리스너 등록 + paste 이벤트 발생 중...');

  const resultPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      document.body.removeEventListener('paste', handler, true);
      resolve({ error: 'TIMEOUT — paste 이벤트가 리스너에 도달하지 않음' });
    }, 5000);

    async function handler(e) {
      clearTimeout(timeout);
      document.body.removeEventListener('paste', handler, true);

      const files = e.clipboardData && e.clipboardData.files;
      if (!files || files.length === 0) {
        resolve({ error: 'paste 이벤트에 파일이 없음' });
        return;
      }

      try {
        const receivedBlob = files[0];
        const receivedBits = await readAlphaLsb(receivedBlob, bitstream.length);

        let match = true;
        let firstMismatch = -1;
        for (let i = 0; i < bitstream.length; i++) {
          if (bitstream[i] !== receivedBits[i]) {
            match = false;
            firstMismatch = i;
            break;
          }
        }
        resolve({ receivedSize: receivedBlob.size, match, firstMismatch, receivedBits });
      } catch (err) {
        resolve({ error: 'File 읽기 실패: ' + err.message });
      }
    }

    document.body.addEventListener('paste', handler, true);
  });

  // paste 발생
  const file = new File([pngBlob], 'diagnostic_lsb.png', { type: 'image/png' });
  const dt = new DataTransfer();
  dt.items.add(file);
  const pasteEvent = new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: dt
  });
  document.body.dispatchEvent(pasteEvent);

  const result = await resultPromise;

  // ── 결과 출력 ──────────────────────────────────────────

  console.log('🔬 [5/5] 결과 분석 중...');
  console.log('\n');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   LSB Paste Diagnostic Result                ║');
  console.log('╠══════════════════════════════════════════════╣');

  if (result.error) {
    console.log('║ ❌ ERROR:', result.error);
    console.log('╚══════════════════════════════════════════════╝');
    return;
  }

  console.log(`║ Original PNG : ${pngBlob.size} bytes`);
  console.log(`║ Received PNG : ${result.receivedSize} bytes`);
  console.log(`║ Bitstream    : ${bitstream.length} bits`);
  console.log('║');

  if (result.match) {
    console.log('║ ✅ Alpha LSB MATCH — 수신 PNG의 LSB가 원본과 일치');
    console.log('║');
    console.log('║ 이제 NovelAI Import 모달을 확인하세요:');
    console.log('║ - 모달이 뜨고 프롬프트가 채워졌다 → LSB paste 성공!');
    console.log('║   → App.tsx를 LSB 인코딩으로 전환하면 됩니다.');
    console.log('║ - 모달이 뜨지만 프롬프트가 비었다 → NovelAI가 이 형식을 안 읽음');
    console.log('║   → fallback(다운로드+업로드)으로 전환해야 합니다.');
    console.log('║ - 모달 자체가 안 뜬다 → paste dispatch 실패');
  } else {
    console.log('║ ❌ Alpha LSB MISMATCH');
    console.log(`║   첫 불일치 위치: bit ${result.firstMismatch}`);
    console.log('║');
    console.log('║ → DataTransfer 경유 시 PNG 픽셀이 변형됨');
    console.log('║   (premultiplied alpha 변환 또는 재인코딩)');
    console.log('║   LSB 인코딩은 paste 경로에서 사용 불가.');
    console.log('║   → fallback(다운로드+업로드)으로 전환해야 합니다.');
  }

  console.log('╚══════════════════════════════════════════════╝');
})();
