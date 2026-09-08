import { useRef } from "react";
import { useTheme } from "../contexts/themeContextCore";

interface Props {
  isLooping: boolean;
  loopCount: number;
  targetCount: number | string;
  onExpand: () => void;
  onStartDrag: (
    clientX: number,
    clientY: number,
    onActualDrag?: () => void,
  ) => void;
}

export default function CollapsedLauncher({
  isLooping,
  loopCount,
  targetCount,
  onExpand,
  onStartDrag,
}: Props) {
  const theme = useTheme();
  const isLauncherDragged = useRef(false);
  const normalizedTargetCount = Number(targetCount);
  const remainingCount = Number.isFinite(normalizedTargetCount)
    ? Math.max(0, Math.ceil(normalizedTargetCount) - loopCount)
    : null;
  const remainingText = remainingCount == null
    ? String(targetCount)
    : String(remainingCount);
  const shouldShowRemainingCount = isLooping && remainingText.length > 0;
  const remainingFontSize = remainingText.length >= 4
    ? "15px"
    : remainingText.length >= 3
      ? "18px"
      : "22px";
  const label = shouldShowRemainingCount
    ? `자동화 남은 이미지 ${remainingText}장`
    : "Easy-to Studio 펼치기";

  return (
    <button
      type="button"
      data-testid="overlay-collapsed-launcher"
      title={label}
      aria-label={label}
      onClick={(event) => {
        if (isLauncherDragged.current) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onExpand();
      }}
      onMouseDown={(event) => {
        if (event.button !== 0) return;
        isLauncherDragged.current = false;
        onStartDrag(event.clientX, event.clientY, () => {
          isLauncherDragged.current = true;
        });
      }}
      onTouchStart={(event) => {
        isLauncherDragged.current = false;
        onStartDrag(
          event.touches[0].clientX,
          event.touches[0].clientY,
          () => {
            isLauncherDragged.current = true;
          },
        );
      }}
      style={{
        alignItems: "center",
        backgroundColor: theme.crust,
        border: shouldShowRemainingCount
          ? `2px solid ${theme.actionAccent}`
          : `1px solid ${theme.surface1}`,
        borderRadius: "999px",
        boxShadow: shouldShowRemainingCount
          ? `0 8px 22px rgba(0,0,0,0.35), 0 0 0 3px ${theme.surface0}`
          : "0 8px 22px rgba(0,0,0,0.35)",
        color: shouldShowRemainingCount ? theme.actionAccent : theme.text,
        cursor: "grab",
        display: "flex",
        flex: "1 1 auto",
        flexDirection: "column",
        fontFamily: theme.fontFamily,
        fontSize: "11px",
        fontWeight: 900,
        height: "100%",
        justifyContent: "center",
        letterSpacing: 0,
        lineHeight: 1,
        padding: 0,
        textShadow: shouldShowRemainingCount ? `0 1px 0 ${theme.base}` : undefined,
        touchAction: "none",
        userSelect: "none",
        width: "100%",
        WebkitUserSelect: "none",
      }}
    >
      {shouldShowRemainingCount ? (
        <span
          data-testid="overlay-collapsed-remaining-count"
          style={{
            color: theme.actionAccent,
            fontSize: remainingFontSize,
            lineHeight: 1,
            maxWidth: "46px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {remainingText}
        </span>
      ) : (
        <>
          <span
            aria-hidden="true"
            style={{
              color: theme.actionAccent,
              fontSize: "17px",
              lineHeight: 1,
              marginBottom: "3px",
            }}
          >
            N
          </span>
          <span style={{ fontSize: "9px", lineHeight: 1 }}>AI</span>
        </>
      )}
    </button>
  );
}
