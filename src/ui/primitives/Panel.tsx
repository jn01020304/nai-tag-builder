import { useState } from "react";
import type { ReactNode, SyntheticEvent } from "react";
import { useTheme } from "../../contexts/themeContextCore";
import { withAlpha } from "../../styles/color";

type PanelVariant = "panel" | "section";

interface PanelProps {
  title: string;
  defaultOpen?: boolean;
  testId?: string;
  variant?: PanelVariant;
  stopPointerPropagation?: boolean;
  children: ReactNode;
}

export default function Panel({
  title,
  defaultOpen = true,
  testId,
  variant = "panel",
  stopPointerPropagation = false,
  children,
}: PanelProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const isPanel = variant === "panel";

  const stopIfNeeded = (event: SyntheticEvent) => {
    if (stopPointerPropagation) event.stopPropagation();
  };

  return (
    <section
      data-testid={testId}
      style={{
        marginBottom: isPanel ? "16px" : "16px",
        backgroundColor: isPanel ? "transparent" : withAlpha(theme.surface0, 0.4),
        border: isPanel ? "none" : `1px solid ${withAlpha(theme.surface1, 0.6)}`,
        borderRadius: isPanel ? "0" : "12px",
        padding: isPanel ? "0" : "12px 16px",
        minWidth: 0,
      }}
    >
      <button
        type="button"
        data-testid={testId ? `${testId}-toggle` : undefined}
        aria-expanded={open}
        onMouseDown={stopIfNeeded}
        onTouchStart={stopIfNeeded}
        onPointerDown={stopIfNeeded}
        onClick={() => setOpen((current) => !current)}
        style={{
          alignItems: "center",
          background: "none",
          border: "none",
          color: theme.subtext1,
          cursor: "pointer",
          display: "flex",
          fontSize: "14px",
          fontWeight: "bold",
          gap: "10px",
          lineHeight: 1.4,
          margin: isPanel ? "0 0 12px" : 0,
          minHeight: isPanel ? "28px" : undefined,
          padding: isPanel ? 0 : "4px 0 12px 0",
          textAlign: "left",
          width: "100%",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            fontSize: "10px",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
            width: "10px",
          }}
        >
          &#9654;
        </span>
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
      </button>
      {open && (
        <div
          data-testid={testId ? `${testId}-body` : undefined}
          style={{
            minWidth: 0,
            padding: isPanel ? 0 : "4px 0 0",
            borderTop: isPanel ? "none" : `1px solid ${withAlpha(theme.surface1, 0.4)}`,
            marginTop: isPanel ? 0 : "4px",
            paddingTop: isPanel ? 0 : "12px",
          }}
        >
          {children}
        </div>
      )}
    </section>
  );
}
