// ============================================================
// NovelAI Paste Handler Inspector
// NovelAI 페이지 콘솔에서 실행하세요.
// 목적: paste 이벤트 리스너의 소스코드를 추출하여
//       메타데이터 파싱 로직을 찾아냅니다.
// ============================================================
(() => {
  'use strict';

  console.log('=== NovelAI Paste Handler Inspector ===\n');

  // ── 1. 등록된 paste 리스너 찾기 ─────────────────────────

  console.log('── [1] paste 이벤트 리스너 탐색 ──');

  // getEventListeners는 DevTools 전용 API
  if (typeof getEventListeners === 'function') {
    const bodyListeners = getEventListeners(document.body);
    const pasteListeners = bodyListeners.paste || [];
    console.log(`body paste 리스너: ${pasteListeners.length}개`);
    pasteListeners.forEach((l, i) => {
      console.log(`\n--- body listener #${i} ---`);
      console.log('useCapture:', l.useCapture);
      console.log('source:\n', l.listener.toString().slice(0, 2000));
    });

    const pm = document.querySelector('.ProseMirror');
    if (pm) {
      const pmListeners = getEventListeners(pm);
      const pmPaste = pmListeners.paste || [];
      console.log(`\nProseMirror paste 리스너: ${pmPaste.length}개`);
      pmPaste.forEach((l, i) => {
        console.log(`\n--- ProseMirror listener #${i} ---`);
        console.log('useCapture:', l.useCapture);
        console.log('source:\n', l.listener.toString().slice(0, 2000));
      });
    }
  } else {
    console.log('⚠️ getEventListeners()는 DevTools 콘솔에서만 사용 가능합니다.');
    console.log('   Chrome DevTools Console에서 직접 실행해주세요.');
  }

  // ── 2. 전역 JS 소스에서 메타데이터 관련 키워드 검색 ─────

  console.log('\n── [2] JS 소스 키워드 검색 ──');

  const keywords = [
    'stealth_pngcomp',
    'stealth_pnginfo',
    'Comment',
    'tEXt',
    'LSB',
    'pnginfo',
    'extractMeta',
    'readMeta',
    'parseMeta',
    'importImage',
    'imageImport',
    'signed_hash',
    'nai_source',
    'Software.*NovelAI',
  ];

  // 모든 <script> 태그의 src를 수집
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  console.log(`로드된 스크립트: ${scripts.length}개`);
  scripts.forEach(s => console.log(' ', s.src));

  // 인라인 스크립트 검사
  const inlineScripts = Array.from(document.querySelectorAll('script:not([src])'));
  console.log(`인라인 스크립트: ${inlineScripts.length}개`);

  inlineScripts.forEach((script, idx) => {
    const text = script.textContent || '';
    keywords.forEach(kw => {
      const regex = new RegExp(kw, 'gi');
      const matches = text.match(regex);
      if (matches) {
        console.log(`  인라인 #${idx}: "${kw}" ${matches.length}회 발견`);
        // 컨텍스트 출력
        let pos = 0;
        while (true) {
          const found = text.indexOf(matches[0], pos);
          if (found === -1) break;
          const start = Math.max(0, found - 100);
          const end = Math.min(text.length, found + 100);
          console.log(`    ...${text.slice(start, end)}...`);
          pos = found + 1;
          if (pos - found > 500) break; // 과도한 출력 방지
        }
      }
    });
  });

  // ── 3. paste 가로채기로 실행 흐름 추적 ──────────────────

  console.log('\n── [3] paste 이벤트 실행 흐름 추적 준비 ──');
  console.log('다음 paste 이벤트에서 콜스택을 캡처합니다...');

  document.body.addEventListener('paste', function traceHandler(e) {
    console.log('\n🔍 paste 이벤트 감지!');
    console.log('target:', e.target);
    console.log('files:', e.clipboardData?.files?.length || 0);

    // 콜스택 추적을 위해 file 읽기를 모니터링
    if (e.clipboardData?.files?.length > 0) {
      const originalFile = e.clipboardData.files[0];
      console.log('file name:', originalFile.name);
      console.log('file type:', originalFile.type);
      console.log('file size:', originalFile.size);

      // arrayBuffer / slice 호출을 모니터링
      const origArrayBuffer = File.prototype.arrayBuffer;
      File.prototype.arrayBuffer = function() {
        console.log('📌 File.arrayBuffer() 호출됨!');
        console.trace('call stack:');
        File.prototype.arrayBuffer = origArrayBuffer; // 복원
        return origArrayBuffer.call(this);
      };

      const origSlice = File.prototype.slice;
      File.prototype.slice = function(...args) {
        console.log('📌 File.slice() 호출됨! args:', args);
        console.trace('call stack:');
        File.prototype.slice = origSlice; // 복원
        return origSlice.call(this, ...args);
      };
    }

    document.body.removeEventListener('paste', traceHandler, true);
  }, true);

  console.log('\n✅ Inspector 설정 완료.');
  console.log('이제 이미지를 paste하면 실행 흐름이 콘솔에 출력됩니다.');
  console.log('또는 기존 nai-tag-builder의 "적용" 버튼을 누르세요.');
})();
