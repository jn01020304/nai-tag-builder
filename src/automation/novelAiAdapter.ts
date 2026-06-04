import type {
  ApplyAutomationErrorCode,
  ApplyAutomationOptions,
  ApplyAutomationPhase,
  ApplyAutomationPhaseEvent,
  ApplyAutomationResult,
} from "./automationTypes";

const DEFAULT_TIMEOUT_MS = 5000;
const POLL_MS = 100;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function findButtonByText(patterns: string[]): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll("button")).find((button) => {
    const text = button.textContent?.trim() ?? "";
    return patterns.some((pattern) => text.includes(pattern));
  }) as HTMLButtonElement | undefined;
}

function findImportButton(): HTMLButtonElement | undefined {
  return findButtonByText(["Import Metadata", "메타데이터 불러오기"]);
}

function findGenerateButton(): HTMLButtonElement | undefined {
  return findButtonByText(["Generate", "생성"]);
}

async function waitFor<T>(
  fn: () => T | undefined,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) return null;
    const result = fn();
    if (result) return result;
    await delay(POLL_MS);
  }
  return null;
}

async function waitUntil(
  fn: () => boolean,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) return false;
    if (fn()) return true;
    await delay(POLL_MS);
  }
  return false;
}

function resolvePasteTarget(): { target: EventTarget; targetKind: "prosemirror" | "body" } | null {
  const proseMirror = document.querySelector(".ProseMirror");
  if (proseMirror) return { target: proseMirror, targetKind: "prosemirror" };
  if (document.body) return { target: document.body, targetKind: "body" };
  return null;
}

function createFailure(
  code: ApplyAutomationErrorCode,
  message: string,
  phases: ApplyAutomationPhaseEvent[],
  detail?: string,
  targetKind?: "prosemirror" | "body",
  pasteWasCanceled?: boolean,
): ApplyAutomationResult {
  return {
    status: "failed",
    code,
    message,
    detail,
    targetKind,
    pasteWasCanceled,
    phases,
  };
}

function createPhaseEmitter(options: ApplyAutomationOptions, phases: ApplyAutomationPhaseEvent[]) {
  return (phase: ApplyAutomationPhase, message: string, detail?: string) => {
    const event = { phase, message, detail };
    phases.push(event);
    options.onPhase?.(event);
  };
}

function abortFailure(phases: ApplyAutomationPhaseEvent[]): ApplyAutomationResult {
  return createFailure("ABORTED", "NovelAI 적용이 중단되었습니다.", phases);
}

export async function applyMetadataToNovelAi(
  blob: Blob,
  options: ApplyAutomationOptions,
): Promise<ApplyAutomationResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const phases: ApplyAutomationPhaseEvent[] = [];
  const emitPhase = createPhaseEmitter(options, phases);

  if (options.signal?.aborted) return abortFailure(phases);

  const targetInfo = resolvePasteTarget();
  if (!targetInfo) {
    return createFailure(
      "PASTE_TARGET_NOT_FOUND",
      "붙여넣기 이벤트를 보낼 NovelAI 입력 영역을 찾지 못했습니다.",
      phases,
    );
  }

  let pasteWasCanceled = false;
  try {
    emitPhase("dispatching-paste", "NovelAI에 메타데이터 PNG를 전달하는 중");

    const file = new File([blob], "novelai_image.png", { type: "image/png" });
    const transfer = new DataTransfer();
    transfer.items.add(file);

    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: transfer,
    });

    pasteWasCanceled = !targetInfo.target.dispatchEvent(pasteEvent);
  } catch (error) {
    return createFailure(
      "PASTE_EVENT_FAILED",
      "붙여넣기 이벤트 생성 또는 발송 중 오류가 발생했습니다.",
      phases,
      errorMessage(error),
      targetInfo.targetKind,
      pasteWasCanceled,
    );
  }

  if (options.signal?.aborted) return abortFailure(phases);

  emitPhase("waiting-import-button", "NovelAI Import Metadata 버튼을 기다리는 중");
  const importButton = await waitFor(findImportButton, timeoutMs, options.signal);
  if (options.signal?.aborted) return abortFailure(phases);
  if (!importButton) {
    return createFailure(
      "IMPORT_BUTTON_TIMEOUT",
      "NovelAI Import Metadata 버튼을 찾지 못했습니다.",
      phases,
      `대기 시간 ${timeoutMs}ms를 초과했습니다. NovelAI UI가 변경되었거나 paste 이벤트가 처리되지 않았을 수 있습니다.`,
      targetInfo.targetKind,
      pasteWasCanceled,
    );
  }

  emitPhase("clicking-import-button", "NovelAI Import Metadata 버튼을 클릭하는 중");
  try {
    if (importButton.disabled) {
      return createFailure(
        "IMPORT_CLICK_FAILED",
        "NovelAI Import Metadata 버튼이 비활성화되어 클릭할 수 없습니다.",
        phases,
        undefined,
        targetInfo.targetKind,
        pasteWasCanceled,
      );
    }
    importButton.click();
  } catch (error) {
    return createFailure(
      "IMPORT_CLICK_FAILED",
      "NovelAI Import Metadata 버튼 클릭 중 오류가 발생했습니다.",
      phases,
      errorMessage(error),
      targetInfo.targetKind,
      pasteWasCanceled,
    );
  }

  emitPhase("waiting-import-complete", "NovelAI 메타데이터 적용 완료를 확인하는 중");
  const importCompleted = await waitUntil(
    () => !importButton.isConnected || !findImportButton(),
    timeoutMs,
    options.signal,
  );
  if (options.signal?.aborted) return abortFailure(phases);
  if (!importCompleted) {
    return createFailure(
      "IMPORT_COMPLETE_TIMEOUT",
      "NovelAI 메타데이터 적용 완료를 확인하지 못했습니다.",
      phases,
      `Import 버튼 클릭 후 ${timeoutMs}ms 안에 완료 상태가 감지되지 않았습니다.`,
      targetInfo.targetKind,
      pasteWasCanceled,
    );
  }

  if (options.mode === "import-and-generate") {
    emitPhase("waiting-generate-button", "NovelAI Generate 버튼을 확인하는 중");
    const generateButton = await waitFor(findGenerateButton, timeoutMs, options.signal);
    if (options.signal?.aborted) return abortFailure(phases);
    if (!generateButton) {
      return createFailure(
        "GENERATE_BUTTON_TIMEOUT",
        "NovelAI Generate 버튼을 찾지 못했습니다.",
        phases,
        undefined,
        targetInfo.targetKind,
        pasteWasCanceled,
      );
    }
    if (generateButton.disabled) {
      return createFailure(
        "GENERATE_BUTTON_DISABLED",
        "NovelAI Generate 버튼이 비활성화되어 자동 생성을 시작하지 못했습니다.",
        phases,
        undefined,
        targetInfo.targetKind,
        pasteWasCanceled,
      );
    }

    emitPhase("clicking-generate-button", "NovelAI Generate 버튼을 클릭하는 중");
    try {
      generateButton.click();
    } catch (error) {
      return createFailure(
        "GENERATE_CLICK_FAILED",
        "NovelAI Generate 버튼 클릭 중 오류가 발생했습니다.",
        phases,
        errorMessage(error),
        targetInfo.targetKind,
        pasteWasCanceled,
      );
    }
  } else {
    findGenerateButton()?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const message = options.mode === "import-and-generate"
    ? "NovelAI 적용 및 Generate 클릭을 완료했습니다."
    : "NovelAI 메타데이터 가져오기를 완료했습니다.";
  emitPhase("completed", message);

  return {
    status: "ok",
    message,
    targetKind: targetInfo.targetKind,
    pasteWasCanceled,
    phases,
  };
}
