import type { ResizeHandle } from "../hooks/useEdgeResize";
import { useTheme } from "../contexts/themeContextCore";

const RESIZE_HANDLES: ResizeHandle[] = [
  "left",
  "right",
  "top",
  "bottom",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

interface Props {
  hidden: boolean;
  onStartResize: (
    handle: ResizeHandle,
    clientX: number,
    clientY: number,
  ) => void;
}

function getCursor(handle: ResizeHandle): React.CSSProperties["cursor"] {
  if (handle === "top-left" || handle === "bottom-right") return "nwse-resize";
  if (handle === "top-right" || handle === "bottom-left") return "nesw-resize";
  if (handle === "left" || handle === "right") return "ew-resize";
  return "ns-resize";
}

export default function OverlayResizeHandles({
  hidden,
  onStartResize,
}: Props) {
  const theme = useTheme();
  if (hidden) return null;

  return (
    <>
      {RESIZE_HANDLES.map((handle) => {
        const pullsLeft = handle.includes("left");
        const pullsRight = handle.includes("right");
        const pullsTop = handle.includes("top");
        const pullsBottom = handle.includes("bottom");
        const isCorner = handle.includes("-");
        const isHorizontalEdge = handle === "left" || handle === "right";

        return (
          <div
            key={handle}
            data-testid={`overlay-resize-${handle}`}
            data-overlay-resize-handle="true"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onStartResize(handle, event.clientX, event.clientY);
            }}
            onTouchStart={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onStartResize(
                handle,
                event.touches[0].clientX,
                event.touches[0].clientY,
              );
            }}
            style={{
              position: "absolute",
              top: pullsBottom ? undefined : 0,
              right: pullsLeft ? undefined : 0,
              bottom: pullsTop ? undefined : 0,
              left: pullsRight ? undefined : 0,
              width: isCorner ? "16px" : isHorizontalEdge ? "12px" : "100%",
              height: isCorner ? "16px" : isHorizontalEdge ? "100%" : "12px",
              cursor: getCursor(handle),
              zIndex: isCorner ? 12 : isHorizontalEdge ? 10 : 11,
              touchAction: "none",
              borderLeft: pullsLeft ? `3px solid ${theme.surface1}` : undefined,
              borderRight: pullsRight ? `3px solid ${theme.surface1}` : undefined,
              borderTop: pullsTop ? `3px solid ${theme.surface1}` : undefined,
              borderBottom: pullsBottom ? `3px solid ${theme.surface1}` : undefined,
              opacity: 0.75,
            }}
          />
        );
      })}
    </>
  );
}
