import { useTheme } from "../contexts/themeContextCore";
import { withAlpha } from "../styles/color";

interface Props {
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapsed: () => void;
  onStartDrag: (clientX: number, clientY: number) => void;
}

export default function OverlayHeader({
  isCollapsed,
  onClose,
  onToggleCollapsed,
  onStartDrag,
}: Props) {
  const theme = useTheme();

  const headerBtnStyle: React.CSSProperties = {
    alignItems: "center",
    backgroundColor: theme.surface0,
    border: `1px solid ${theme.surface1}`,
    borderRadius: "999px",
    cursor: "pointer",
    display: "inline-flex",
    flex: "0 0 28px",
    height: "28px",
    justifyContent: "center",
    lineHeight: 1,
    padding: 0,
    transition: "background-color 120ms ease, border-color 120ms ease, transform 120ms ease",
    width: "28px",
  };

  const chevronStyle: React.CSSProperties = {
    borderBottom: `2px solid ${theme.subtext0}`,
    borderRight: `2px solid ${theme.subtext0}`,
    display: "block",
    height: "8px",
    transform: isCollapsed ? "rotate(-135deg) translate(-1px, -1px)" : "rotate(45deg) translate(-1px, -1px)",
    width: "8px",
  };

  const closeLineStyle: React.CSSProperties = {
    backgroundColor: theme.red,
    borderRadius: "999px",
    display: "block",
    height: "2px",
    left: "7px",
    position: "absolute",
    top: "13px",
    width: "14px",
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
        backgroundColor: withAlpha(theme.crust, 0.85),
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "none",
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
      <span
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        Easy-to Studio v1.0
      </span>
      <div style={{ alignItems: "center", display: "flex", flex: "0 0 auto", gap: "8px" }}>
        <button
          onClick={onToggleCollapsed}
          title={isCollapsed ? "펼치기" : "접기"}
          aria-label={isCollapsed ? "펼치기" : "접기"}
          style={headerBtnStyle}
        >
          <span aria-hidden="true" style={chevronStyle} />
        </button>
        <button
          onClick={onClose}
          title="닫기"
          aria-label="닫기"
          style={{ ...headerBtnStyle, position: "relative" }}
        >
          <span aria-hidden="true" style={{ ...closeLineStyle, transform: "rotate(45deg)" }} />
          <span aria-hidden="true" style={{ ...closeLineStyle, transform: "rotate(-45deg)" }} />
        </button>
      </div>
    </div>
  );
}
