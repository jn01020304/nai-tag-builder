import type { QueueSession } from "../queue/queueTypes";
import type { QueueMode, SeedRule } from "../types/preset";
import { useThemeStyles } from "../contexts/themeContextCore";
import { withAlpha } from "../styles/color";

type QueueAutomationState = "off" | "on";

interface QueuePanelProps {
  autoGenerate: boolean;
  setAutoGenerate: (val: boolean) => void;
  seedRule: SeedRule;
  setSeedRule: (val: SeedRule) => void;
  queueMode: QueueMode;
  setQueueMode: (val: QueueMode) => void;
  runsPerPreset: number | string;
  setRunsPerPreset: (val: number | string) => void;
  adjustStep: number | string;
  setAdjustStep: (val: number | string) => void;
  intervalSec: number | string;
  handleIntervalChange: (val: string) => void;
  targetCount: number | string;
  handleCountChange: (val: string) => void;
  targetMin: number | string;
  handleMinChange: (val: string) => void;
  adjustValue: (type: "interval" | "count", dir: 1 | -1) => void;
  queueLength: number;
  queueSession: QueueSession | null;
}

function queueStatusLabel(session: QueueSession | null): string {
  if (!session) return "대기 중";

  switch (session.status) {
    case "starting":
      return "시작 준비";
    case "waiting":
      return "다음 tick 대기";
    case "applying":
      return "NovelAI 적용 중";
    case "generating":
      return "생성 완료 대기";
    case "cooldown":
      return "완료 후 대기";
    case "completed":
      return "완료";
    case "failed":
      return "실패";
    case "stopped":
      return "중지됨";
    default:
      return "대기 중";
  }
}

export default function QueueWorkspace({
  autoGenerate,
  setAutoGenerate,
  seedRule,
  setSeedRule,
  queueMode,
  setQueueMode,
  runsPerPreset,
  setRunsPerPreset,
  adjustStep,
  setAdjustStep,
  intervalSec,
  handleIntervalChange,
  targetCount,
  handleCountChange,
  targetMin,
  handleMinChange,
  adjustValue,
  queueLength,
  queueSession,
}: QueuePanelProps) {
  const { theme, inputStyle, labelStyle, smallBtnStyle } = useThemeStyles();
  const miniBtn: React.CSSProperties = {
    ...smallBtnStyle,
    alignItems: "center",
    display: "inline-flex",
    flex: "0 0 28px",
    height: "28px",
    justifyContent: "center",
    padding: 0,
  };

  const pairedRow: React.CSSProperties = {
    display: "grid",
    gap: "8px",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    minWidth: 0,
  };
  const stackedField: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  };
  const stepperControls: React.CSSProperties = {
    alignItems: "center",
    display: "grid",
    gap: "6px",
    gridTemplateColumns: "28px minmax(42px, 1fr) 28px auto",
    minWidth: 0,
  };
  const stepperInput: React.CSSProperties = {
    ...inputStyle,
    minWidth: 0,
    padding: "5px 6px",
    textAlign: "center",
    width: "100%",
  };
  const queueAutomationState: QueueAutomationState = autoGenerate ? "on" : "off";
  const handleQueueAutomationChange = (value: QueueAutomationState) => {
    setAutoGenerate(value === "on");
  };

  const statusTone = queueSession?.status === "failed"
    ? theme.warningError
    : queueSession?.status === "completed"
      ? theme.green
      : theme.blue;

  return (
    <div data-testid="queue-workspace" style={{ paddingBottom: '16px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 12px 0', color: theme.text }}>
        Auto-Queue Configuration
      </h2>
      <section
        aria-label="Queue"
        data-testid="queue-panel"
        style={{
          backgroundColor: withAlpha(theme.surface0, 0.4),
          border: 'none',
          borderRadius: "8px",
          marginBottom: "12px",
          padding: "12px",
        }}
      >
      <div style={{ alignItems: "center", display: "flex", gap: "12px", marginBottom: "12px" }}>
        <span style={{ ...labelStyle, marginBottom: 0 }}>Queue</span>
        <span
          data-testid="queue-status"
          style={{
            backgroundColor: withAlpha(statusTone, 0.18),
            border: `1px solid ${withAlpha(statusTone, 0.45)}`,
            borderRadius: "999px",
            color: theme.text,
            flex: "0 1 auto",
            fontSize: "11px",
            fontWeight: 700,
            minWidth: 0,
            overflow: "hidden",
            padding: "2px 8px",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {queueStatusLabel(queueSession)}
        </span>
        
        {queueSession && queueSession.status !== "idle" && queueSession.status !== "stopped" && queueSession.status !== "failed" && (
          <div
            data-testid="queue-progress"
            style={{
              color: theme.subtext0,
              fontSize: "11px",
              marginLeft: "auto",
              textAlign: "right",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "140px",
            }}
          >
            {queueSession.currentPlan?.source.name && (
              <span style={{ marginRight: "4px" }}>{queueSession.currentPlan.source.name}</span>
            )}
            <span style={{ fontWeight: 600 }}>{queueSession.completedCount}</span>
            <span style={{ color: theme.subtext1 }}> / {queueSession.targetCount}</span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={pairedRow}>
          <div style={stackedField}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>자동화</label>
            <select
              data-testid="queue-mode-select"
              value={queueAutomationState}
              onChange={(e) => handleQueueAutomationChange(e.target.value as QueueAutomationState)}
              style={{ ...inputStyle, minWidth: 0, padding: "5px 6px" }}
            >
              <option value="off">끄기</option>
              <option value="on">켜기</option>
            </select>
          </div>

          <div style={stackedField}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Seed</label>
            <select
              data-testid="queue-seed-rule-select"
              value={seedRule}
              onChange={(e) => setSeedRule(e.target.value as SeedRule)}
              style={{ ...inputStyle, minWidth: 0, padding: "5px 6px" }}
            >
              <option value="random">랜덤</option>
              <option value="increment">+1</option>
              <option value="decrement">-1</option>
              <option value="none">프리셋 seed 유지</option>
            </select>
          </div>
        </div>

        <div style={pairedRow}>
          <div style={stackedField}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>대기열 처리</label>
            <select
              data-testid="queue-run-mode-select"
              value={queueMode}
              onChange={(e) => setQueueMode(e.target.value as QueueMode)}
              style={{ ...inputStyle, minWidth: 0, padding: "5px 6px" }}
            >
              <option value="batched">묶음</option>
              <option value="randomized">랜덤</option>
            </select>
          </div>

          <div style={stackedField}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>프리셋당</label>
            <input
              data-testid="queue-runs-per-preset-input"
              type="number"
              min="1"
              disabled={queueMode === "randomized" || queueLength === 0}
              value={runsPerPreset}
              onChange={(e) => setRunsPerPreset(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))}
              style={{ ...inputStyle, minWidth: 0, padding: "5px 6px", textAlign: "center" }}
            />
          </div>
        </div>

        <div style={pairedRow}>
          <div style={stackedField}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>단위</label>
            <input
              data-testid="queue-adjust-step-input"
              type="number"
              value={adjustStep}
              onChange={(e) => setAdjustStep(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))}
              style={{ ...inputStyle, minWidth: 0, padding: "5px 6px", textAlign: "center" }}
            />
          </div>

          <div style={stackedField}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>시간</label>
            <input
              data-testid="queue-target-min-input"
              type="number"
              step="0.1"
              value={targetMin}
              onChange={(e) => handleMinChange(e.target.value)}
              style={{ ...inputStyle, minWidth: 0, padding: "5px 6px", textAlign: "center" }}
            />
          </div>
        </div>

        <div style={pairedRow}>
          <div style={stackedField}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>간격</label>
            <div style={stepperControls}>
              <button type="button" onClick={() => adjustValue("interval", -1)} style={miniBtn}>-</button>
              <input
                data-testid="queue-interval-input"
                type="number"
                value={intervalSec}
                onChange={(e) => handleIntervalChange(e.target.value)}
                style={stepperInput}
              />
              <button type="button" onClick={() => adjustValue("interval", 1)} style={miniBtn}>+</button>
              <span style={{ color: theme.subtext0, fontSize: "11px" }}>초</span>
            </div>
          </div>

          <div style={stackedField}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>목표</label>
            <div style={stepperControls}>
              <button type="button" onClick={() => adjustValue("count", -1)} style={miniBtn}>-</button>
              <input
                data-testid="queue-target-count-input"
                type="number"
                value={targetCount}
                onChange={(e) => handleCountChange(e.target.value)}
                style={stepperInput}
              />
              <button type="button" onClick={() => adjustValue("count", 1)} style={miniBtn}>+</button>
              <span style={{ color: theme.subtext0, fontSize: "11px" }}>회</span>
            </div>
          </div>
        </div>

          {queueSession?.lastError && (
            <div
              data-testid="queue-last-error"
              style={{
                backgroundColor: withAlpha(theme.warningError, 0.14),
                border: `1px solid ${withAlpha(theme.warningError, 0.45)}`,
                borderRadius: "6px",
                color: theme.text,
                fontSize: "11px",
                lineHeight: 1.4,
                padding: "7px",
              }}
            >
              {queueSession.lastError.message}
            </div>
          )}
      </div>
      </section>
    </div>
  );
}
