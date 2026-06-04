import type { ApplyPipelinePhase } from "./applyPipeline";
import type { ApplyAutomationErrorCode } from "./automationTypes";

const APPLY_PHASE_ACTION_LABELS: Record<ApplyPipelinePhase, string> = {
  planning: "준비 중...",
  "encoding-png": "PNG 생성 중...",
  "dispatching-paste": "DOM 주입 중...",
  "waiting-import-button": "Import 버튼 대기 중...",
  "clicking-import-button": "Import 클릭 중...",
  "waiting-import-complete": "적용 확인 중...",
  "waiting-generate-button": "Generate 버튼 대기 중...",
  "clicking-generate-button": "Generate 클릭 중...",
  completed: "완료됨",
};

const APPLY_PHASE_STATUS_LABELS: Record<ApplyPipelinePhase, string> = {
  planning: "NovelAI 메타데이터 준비 중",
  "encoding-png": "PNG 메타데이터 생성 중",
  "dispatching-paste": "NovelAI DOM 주입 중",
  "waiting-import-button": "Import 버튼 대기 중",
  "clicking-import-button": "Import 버튼 클릭 중",
  "waiting-import-complete": "Import 완료 확인 중",
  "waiting-generate-button": "Generate 버튼 대기 중",
  "clicking-generate-button": "Generate 버튼 클릭 중",
  completed: "적용 완료",
};

const APPLY_ERROR_RECOVERY_HINTS: Record<ApplyAutomationErrorCode, string> = {
  PASTE_TARGET_NOT_FOUND:
    "NovelAI 이미지 페이지가 완전히 로드됐는지 확인하고, 페이지를 새로고침한 뒤 다시 적용해 주세요.",
  PASTE_EVENT_FAILED:
    "브라우저 권한 또는 확장 프로그램 간섭일 수 있습니다. 같은 페이지에서 북마클릿을 다시 실행해 주세요.",
  IMPORT_BUTTON_TIMEOUT:
    "NovelAI가 PNG 메타데이터를 인식하지 못했거나 UI가 바뀌었을 수 있습니다. Base Prompt 영역이 보이는 상태에서 다시 적용하고, 계속 실패하면 북마클릿을 새로 불러와 주세요.",
  IMPORT_CLICK_FAILED:
    "NovelAI 팝업이나 로딩 상태가 클릭을 막고 있을 수 있습니다. 잠시 기다린 뒤 다시 시도해 주세요.",
  IMPORT_COMPLETE_TIMEOUT:
    "NovelAI Import 처리가 멈춘 상태일 수 있습니다. 현재 NovelAI 화면의 값이 바뀌었는지 확인한 뒤, 불확실하면 페이지 상태를 먼저 확인해 주세요.",
  GENERATE_BUTTON_TIMEOUT:
    "자동 생성은 중단되었습니다. NovelAI Generate 버튼이 화면에 표시되는지 확인하거나, 자동 생성을 끄고 Import만 먼저 적용해 주세요.",
  GENERATE_BUTTON_DISABLED:
    "NovelAI가 아직 입력을 처리 중이거나 필수 값이 유효하지 않을 수 있습니다. 파라미터와 Anlas 상태를 확인한 뒤 다시 시도해 주세요.",
  GENERATE_CLICK_FAILED:
    "NovelAI UI 위에 다른 팝업이나 오버레이가 있는지 확인하고 다시 시도해 주세요.",
  ABORTED:
    "적용이 중단되었습니다. 현재 NovelAI 화면 상태를 확인한 뒤 다시 적용해 주세요.",
};

export function getApplyPhaseActionLabel(phase: ApplyPipelinePhase | null | undefined): string {
  if (!phase) return "적용 중...";
  return APPLY_PHASE_ACTION_LABELS[phase];
}

export function getApplyPhaseStatusLabel(phase: ApplyPipelinePhase | null | undefined): string {
  if (!phase) return "NovelAI 적용 중";
  return APPLY_PHASE_STATUS_LABELS[phase];
}

export function getApplyErrorRecoveryHint(code: ApplyAutomationErrorCode): string {
  return APPLY_ERROR_RECOVERY_HINTS[code];
}

export function formatApplyErrorDetail(
  code: ApplyAutomationErrorCode,
  detail?: string,
): string {
  return [code, detail, getApplyErrorRecoveryHint(code)].filter(Boolean).join("\n");
}
