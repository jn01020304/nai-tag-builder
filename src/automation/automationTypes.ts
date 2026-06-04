export type ApplyAutomationMode = "import-only" | "import-and-generate";

export type ApplyAutomationPhase =
  | "dispatching-paste"
  | "waiting-import-button"
  | "clicking-import-button"
  | "waiting-import-complete"
  | "waiting-generate-button"
  | "clicking-generate-button"
  | "completed";

export type ApplyAutomationErrorCode =
  | "PASTE_TARGET_NOT_FOUND"
  | "PASTE_EVENT_FAILED"
  | "IMPORT_BUTTON_TIMEOUT"
  | "IMPORT_CLICK_FAILED"
  | "IMPORT_COMPLETE_TIMEOUT"
  | "GENERATE_BUTTON_TIMEOUT"
  | "GENERATE_BUTTON_DISABLED"
  | "GENERATE_CLICK_FAILED"
  | "ABORTED";

export interface ApplyAutomationPhaseEvent {
  phase: ApplyAutomationPhase;
  message: string;
  detail?: string;
}

export interface ApplyAutomationSuccess {
  status: "ok";
  message: string;
  targetKind: "prosemirror" | "body";
  pasteWasCanceled: boolean;
  phases: ApplyAutomationPhaseEvent[];
}

export interface ApplyAutomationFailure {
  status: "failed";
  code: ApplyAutomationErrorCode;
  message: string;
  detail?: string;
  targetKind?: "prosemirror" | "body";
  pasteWasCanceled?: boolean;
  phases: ApplyAutomationPhaseEvent[];
}

export type ApplyAutomationResult = ApplyAutomationSuccess | ApplyAutomationFailure;

export interface ApplyAutomationOptions {
  mode: ApplyAutomationMode;
  signal?: AbortSignal;
  timeoutMs?: number;
  onPhase?: (event: ApplyAutomationPhaseEvent) => void;
}
