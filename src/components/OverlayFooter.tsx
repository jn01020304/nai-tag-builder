import { useTheme } from "../contexts/themeContextCore";
import type { ApplyPipelinePhase } from "../automation/applyPipeline";
import { getApplyPhaseActionLabel, getApplyPhaseStatusLabel } from "../automation/applyStatusText";
import type { StatusFeedback } from "../types/feedback";
import ApplyButton from "./ApplyButton";

interface Props {
  feedback: StatusFeedback | null;
  isApplying: boolean;
  applyPhase: ApplyPipelinePhase | null;
  isLooping: boolean;
  loopCount: number;
  targetCount: number | string;
  onApply: () => void;
  onStopLoop: () => void;
}

export default function OverlayFooter({
  feedback,
  isApplying,
  applyPhase,
  isLooping,
  loopCount,
  targetCount,
  onApply,
  onStopLoop,
}: Props) {
  const theme = useTheme();
  const statusText = (() => {
    if (isApplying) return getApplyPhaseStatusLabel(applyPhase);
    if (feedback) return feedback.message;
    if (isLooping) return `생성 중 ${loopCount}/${targetCount}`;
    return "적용 준비됨";
  })();

  return (
    <div
      data-testid="overlay-footer"
      style={{
        backgroundColor: theme.base,
        borderTop: `1px solid ${theme.surface0}`,
        boxShadow: "0 -6px 14px rgba(0, 0, 0, 0.12)",
        flex: "0 0 auto",
        padding: "8px 12px 10px",
        zIndex: 2,
      }}
    >
      <div
        data-testid="overlay-footer-status"
        style={{
          alignItems: "center",
          backgroundColor: feedback?.tone === "error" ? "rgba(248, 48, 48, 0.16)" : "#15172f",
          border: `1px solid ${feedback?.tone === "error" ? theme.warningError : "rgba(255, 255, 255, 0.25)"}`,
          borderRadius: "999px",
          color: feedback?.tone === "error" ? theme.warningError : "#ffffff",
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

      {isLooping ? (
        <button
          type="button"
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
        <ApplyButton
          isApplying={isApplying}
          label={getApplyPhaseActionLabel(applyPhase)}
          onApply={onApply}
        />
      )}
    </div>
  );
}
