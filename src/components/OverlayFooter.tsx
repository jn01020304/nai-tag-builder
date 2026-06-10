import { useTheme } from "../contexts/themeContextCore";
import type { ApplyPipelinePhase } from "../automation/applyPipeline";
import { getApplyPhaseActionLabel, getApplyPhaseStatusLabel } from "../automation/applyStatusText";
import type { StatusFeedback } from "../types/feedback";
import { withAlpha } from "../styles/color";
import ApplyButton from "./ApplyButton";

interface Props {
  appMode?: 'compose' | 'queue';
  queueEnabled?: boolean;
  feedback: StatusFeedback | null;
  isApplying: boolean;
  applyPhase: ApplyPipelinePhase | null;
  isLooping: boolean;
  loopCount: number;
  targetCount: number | string;
  onApply: () => void;
  onStartLoop?: () => void;
  onStopLoop: () => void;
}

export default function OverlayFooter({
  appMode = 'compose',
  queueEnabled,
  feedback,
  isApplying,
  applyPhase,
  isLooping,
  loopCount,
  targetCount,
  onApply,
  onStartLoop,
  onStopLoop,
}: Props) {
  const theme = useTheme();
  const canStartQueue = appMode === "queue" && queueEnabled !== false && !isApplying;

  const statusText = (() => {
    if (isApplying) return getApplyPhaseStatusLabel(applyPhase);
    if (feedback) return feedback.message;
    if (isLooping) return `생성 중 ${loopCount}/${targetCount}`;
    if (appMode === "queue" && queueEnabled === false) return "Auto-Queue 꺼짐";
    if (appMode === "queue") return "Queue 준비됨";
    return "적용 준비됨";
  })();

  return (
    <div
      data-testid="overlay-footer"
      style={{
        backgroundColor: withAlpha(theme.base, 0.85),
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "none",
        boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.15)",
        flex: "0 0 auto",
        padding: "12px 16px 16px",
        zIndex: 2,
      }}
    >
      <div
        data-testid="overlay-footer-status"
        style={{
          alignItems: "center",
          backgroundColor: feedback?.tone === "error" ? withAlpha(theme.warningError, 0.16) : theme.mantle,
          border: `1px solid ${feedback?.tone === "error" ? theme.warningError : theme.surface1}`,
          borderRadius: "999px",
          color: feedback?.tone === "error" ? theme.warningError : theme.text,
          display: "inline-flex",
          fontSize: "11px",
          fontWeight: 700,
          lineHeight: 1.35,
          marginBottom: "6px",
          minHeight: "15px",
          overflow: "hidden",
          padding: "2px 8px",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {statusText}
      </div>

      {appMode === 'queue' ? (
        isLooping ? (
          <button
            type="button"
            data-testid="stop-queue-button"
            onClick={onStopLoop}
            style={{
              backgroundColor: theme.warningError,
              border: "none",
              borderRadius: "6px",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              padding: "12px",
              width: "100%",
            }}
          >
            반복 생성 중지
          </button>
        ) : (
          <button
            type="button"
            data-testid="start-queue-button"
            onClick={canStartQueue ? onStartLoop : undefined}
            disabled={!canStartQueue}
            style={{
              backgroundColor: theme.actionAccent,
              border: "none",
              borderRadius: "6px",
              color: "#ffffff",
              cursor: canStartQueue ? "pointer" : "not-allowed",
              fontSize: "14px",
              fontWeight: "bold",
              padding: "12px",
              width: "100%",
              opacity: canStartQueue ? 1 : 0.55,
            }}
          >
            {queueEnabled === false ? "Auto-Queue 꺼짐" : "자동 생성 시작 (Auto-Queue)"}
          </button>
        )
      ) : (
        <ApplyButton
          isApplying={isApplying}
          label={getApplyPhaseActionLabel(applyPhase) || "Load to Canvas"}
          onApply={onApply}
        />
      )}
    </div>
  );
}
