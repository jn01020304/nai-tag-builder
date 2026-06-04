import { useTheme } from "../contexts/themeContextCore";

interface Props {
  isCollapsed: boolean;
  isLooping: boolean;
  loopCount: number;
  targetCount: number | string;
  onClose: () => void;
  onStopLoop: () => void;
  onToggleCollapsed: () => void;
  onStartDrag: (clientX: number, clientY: number) => void;
}

export default function OverlayHeader({
  isCollapsed,
  isLooping,
  loopCount,
  targetCount,
  onClose,
  onStopLoop,
  onToggleCollapsed,
  onStartDrag,
}: Props) {
  const theme = useTheme();

  const headerBtnStyle: React.CSSProperties = {
    alignItems: "center",
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "inline-flex",
    fontSize: "16px",
    fontWeight: "bold",
    justifyContent: "center",
    lineHeight: 1,
    padding: "0 2px",
  };

  return (
    <div
      data-testid="overlay-header"
      onMouseDown={(e) => {
        if ((e.target as Element).closest("button")) return;
        if (e.button === 0) onStartDrag(e.clientX, e.clientY);
      }}
      onTouchStart={(e) => {
        if ((e.target as Element).closest("button")) return;
        onStartDrag(e.touches[0].clientX, e.touches[0].clientY);
      }}
      style={{
        alignItems: "center",
        backgroundColor: theme.crust,
        borderBottom: isCollapsed ? "none" : `1px solid ${theme.surface0}`,
        borderRadius: isCollapsed ? "12px" : "12px 12px 0 0",
        cursor: "grab",
        display: "flex",
        flex: "0 0 auto",
        fontSize: "14px",
        fontWeight: "bold",
        justifyContent: "space-between",
        padding: "10px 16px",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        zIndex: 2,
      }}
    >
      <span>NAI Tag Builder v2.0</span>
      <div style={{ alignItems: "center", display: "flex", gap: "8px" }}>
        {isLooping && (
          <button
            onClick={onStopLoop}
            title="반복 중지"
            style={{ ...headerBtnStyle, color: theme.yellow, gap: "4px" }}
          >
            <span style={{ fontSize: "10px" }}>({loopCount}/{targetCount})</span>
            &#9632;
          </button>
        )}
        <button
          onClick={onToggleCollapsed}
          title={isCollapsed ? "펼치기" : "접기"}
          style={{ ...headerBtnStyle, color: theme.subtext0 }}
        >
          {isCollapsed ? "▲" : "▼"}
        </button>
        <button
          onClick={onClose}
          title="닫기"
          style={{ ...headerBtnStyle, color: theme.red }}
        >
          &#10005;
        </button>
      </div>
    </div>
  );
}
