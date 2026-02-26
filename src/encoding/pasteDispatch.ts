function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor<T>(
  fn: () => T | undefined,
  timeoutMs: number
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = fn();
    if (result) return result;
    await delay(100);
  }
  return null;
}

async function autoImportAndScroll(): Promise<void> {
  try {
    // 1. Import Metadata 버튼이 나타날 때까지 대기 (최대 3초)
    const importBtn = await waitFor<HTMLButtonElement>(
      () => Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent?.trim() === 'Import Metadata') as HTMLButtonElement | undefined,
      3000
    );
    if (!importBtn) return;

    importBtn.click();

    // 2. 모달이 닫힐 때까지 대기 (Import Metadata 버튼 사라짐)
    await waitFor(
      () => !Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent?.trim() === 'Import Metadata'),
      3000
    );

    // 3. Generate 버튼으로 스크롤
    await delay(300);
    const genBtn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Generate')) as HTMLButtonElement | undefined;
    genBtn?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch {
    // 자동화 실패해도 기본 import 흐름은 유지됨
  }
}

export function dispatchPasteEvent(blob: Blob): void {
  const file = new File([blob], 'novelai_image.png', { type: 'image/png' });
  const dt = new DataTransfer();
  dt.items.add(file);

  const pasteEvent = new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: dt,
  });

  const target = document.querySelector('.ProseMirror') || document.body;
  target.dispatchEvent(pasteEvent);

  void autoImportAndScroll();
}
