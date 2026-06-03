function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export type ImportAutomationStatus = 'ok' | 'failed';

export type ImportAutomationReason =
  | 'import-button-missing'
  | 'import-dialog-timeout'
  | 'generate-button-missing'
  | 'generate-button-disabled'
  | 'exception';

export interface ImportAutomationResult {
  status: ImportAutomationStatus;
  message: string;
  reason?: ImportAutomationReason;
}

export type PasteDispatchStatus = 'ok' | 'failed';

export type PasteDispatchFailureReason =
  | 'paste-target-missing'
  | 'clipboard-event-failed'
  | 'import-automation-failed';

export interface PasteDispatchResult {
  status: PasteDispatchStatus;
  message: string;
  reason?: PasteDispatchFailureReason;
  targetKind?: 'prosemirror' | 'body';
  pasteWasCanceled?: boolean;
  importResult?: ImportAutomationResult;
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

async function waitUntil(fn: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fn()) return true;
    await delay(100);
  }
  return false;
}

function findImportButton(): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button'))
    .find(b => {
      const t = b.textContent?.trim();
      return t === 'Import Metadata' || t === '메타데이터 불러오기';
    }) as HTMLButtonElement | undefined;
}

function findGenerateButton(): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button'))
    .find(b => {
      const t = b.textContent || '';
      return t.includes('Generate') || t.includes('생성');
    }) as HTMLButtonElement | undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failImport(reason: ImportAutomationReason, message: string): ImportAutomationResult {
  return { status: 'failed', reason, message };
}

async function autoImportAndScroll(autoGenerate: boolean): Promise<ImportAutomationResult> {
  try {
    const importBtn = await waitFor<HTMLButtonElement>(findImportButton, 3000);
    if (!importBtn) {
      return failImport(
        'import-button-missing',
        'NovelAI 메타데이터 가져오기 버튼을 찾지 못했습니다.'
      );
    }

    importBtn.click();

    const importSettled = await waitUntil(() => !findImportButton(), 3000);
    if (!importSettled) {
      return failImport(
        'import-dialog-timeout',
        'NovelAI 메타데이터 가져오기 동작이 제한 시간 안에 완료되지 않았습니다.'
      );
    }

    await delay(300);
    const genBtn = findGenerateButton();

    if (autoGenerate) {
      if (!genBtn) {
        return failImport(
          'generate-button-missing',
          'NovelAI 생성 버튼을 찾지 못해 자동 생성을 시작하지 못했습니다.'
        );
      }
      if (genBtn.disabled) {
        return failImport(
          'generate-button-disabled',
          'NovelAI 생성 버튼이 비활성화되어 자동 생성을 시작하지 못했습니다.'
        );
      }
      genBtn.click();
    } else {
      genBtn?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    return { status: 'ok', message: 'NovelAI 메타데이터 가져오기를 완료했습니다.' };
  } catch (error) {
    return failImport(
      'exception',
      `NovelAI 메타데이터 가져오기 중 오류가 발생했습니다: ${errorMessage(error)}`
    );
  }
}

function failPaste(reason: PasteDispatchFailureReason, message: string): PasteDispatchResult {
  return { status: 'failed', reason, message };
}

export async function dispatchPasteEvent(blob: Blob, autoGenerate = false): Promise<PasteDispatchResult> {
  try {
    const file = new File([blob], 'novelai_image.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);

    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dt,
    });

    const proseMirror = document.querySelector('.ProseMirror');
    const target = proseMirror || document.body;
    if (!target) {
      return failPaste('paste-target-missing', '붙여넣기 이벤트를 보낼 대상 영역을 찾지 못했습니다.');
    }

    const pasteWasAccepted = target.dispatchEvent(pasteEvent);
    const importResult = await autoImportAndScroll(autoGenerate);
    const baseResult = {
      targetKind: proseMirror ? 'prosemirror' as const : 'body' as const,
      pasteWasCanceled: !pasteWasAccepted,
      importResult,
    };

    if (importResult.status === 'failed') {
      return {
        ...baseResult,
        status: 'failed',
        reason: 'import-automation-failed',
        message: importResult.message,
      };
    }

    return {
      ...baseResult,
      status: 'ok',
      message: importResult.message,
    };
  } catch (error) {
    return failPaste(
      'clipboard-event-failed',
      `붙여넣기 이벤트 생성 또는 발송 중 오류가 발생했습니다: ${errorMessage(error)}`
    );
  }
}
