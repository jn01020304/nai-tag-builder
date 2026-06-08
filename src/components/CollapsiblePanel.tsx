import { useState } from "react";
import { useTheme } from "../contexts/themeContextCore";

interface Props {
  title: string;
  defaultOpen?: boolean;
  testId: string;
  children: React.ReactNode;
}

export default function CollapsiblePanel({
  title,
  defaultOpen = true,
  testId,
  children,
}: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section data-testid={testId} style={{ marginBottom: "10px", minWidth: 0 }}>
      <button
        type="button"
        data-testid={`${testId}-toggle`}
        aria-expanded={open}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setOpen((current) => !current)}
        style={{
          alignItems: "center",
          background: "none",
          border: "none",
          color: theme.subtext1,
          cursor: "pointer",
          display: "flex",
          fontSize: "13px",
          fontWeight: 800,
          gap: "6px",
          lineHeight: 1.2,
          margin: "0 0 7px",
          minHeight: "26px",
          padding: 0,
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
        <div data-testid={`${testId}-body`} style={{ minWidth: 0 }}>
          {children}
        </div>
      )}
    </section>
  );
}
