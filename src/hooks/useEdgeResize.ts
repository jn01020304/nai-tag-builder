import { useState } from "react";

export type ResizeHandle =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

const VIEWPORT_PADDING = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getOverlayRect(rootId: string): DOMRect | null {
  const root = document.getElementById(rootId);
  const overlay = root?.firstElementChild;
  if (overlay instanceof HTMLElement) return overlay.getBoundingClientRect();
  if (root instanceof HTMLElement) return root.getBoundingClientRect();
  return null;
}

export function useEdgeResize(minWidth: number, rootId: string) {
  const [overlayWidth, setOverlayWidth] = useState(minWidth);
  const [overlayHeight, setOverlayHeight] = useState<number | null>(null);

  const startResize = (handle: ResizeHandle, clientX: number, clientY: number) => {
    const root = document.getElementById(rootId) as HTMLElement | null;
    const rect = getOverlayRect(rootId);
    if (!rect) return;

    const pullsLeft = handle.includes("left");
    const pullsRight = handle.includes("right");
    const pullsTop = handle.includes("top");
    const pullsBottom = handle.includes("bottom");
    const resizesWidth = pullsLeft || pullsRight;
    const resizesHeight = pullsTop || pullsBottom;
    const minHeight = Math.min(260, Math.max(180, window.innerHeight - VIEWPORT_PADDING * 2));
    const startX = clientX;
    const startY = clientY;
    const startWidth = Math.max(minWidth, rect.width || overlayWidth);
    const startHeight = Math.max(minHeight, rect.height || overlayHeight || minHeight);
    const startLeft = clamp(
      rect.left,
      VIEWPORT_PADDING,
      window.innerWidth - VIEWPORT_PADDING - minWidth,
    );
    const startRight = clamp(
      rect.right,
      VIEWPORT_PADDING + minWidth,
      window.innerWidth - VIEWPORT_PADDING,
    );
    const startTop = clamp(
      rect.top,
      VIEWPORT_PADDING,
      window.innerHeight - VIEWPORT_PADDING - minHeight,
    );
    const startBottom = clamp(
      rect.bottom,
      VIEWPORT_PADDING + minHeight,
      window.innerHeight - VIEWPORT_PADDING,
    );
    const maxWidth = pullsLeft
      ? Math.max(minWidth, startRight - VIEWPORT_PADDING)
      : Math.max(minWidth, window.innerWidth - VIEWPORT_PADDING - startLeft);
    const maxHeight = pullsTop
      ? Math.max(minHeight, startBottom - VIEWPORT_PADDING)
      : Math.max(minHeight, window.innerHeight - VIEWPORT_PADDING - startTop);

    const nextWidth = (currentX: number) => {
      const delta = pullsLeft ? startX - currentX : currentX - startX;
      return clamp(startWidth + delta, minWidth, maxWidth);
    };

    const nextHeight = (currentY: number) => {
      const delta = pullsTop ? startY - currentY : currentY - startY;
      return clamp(startHeight + delta, minHeight, maxHeight);
    };

    const applyWidth = (width: number) => {
      if (root) {
        root.style.right = "";
        root.style.left = pullsLeft
          ? `${clamp(startRight - width, VIEWPORT_PADDING, startRight - minWidth)}px`
          : `${clamp(startLeft, VIEWPORT_PADDING, window.innerWidth - VIEWPORT_PADDING - minWidth)}px`;
      }

      setOverlayWidth(width);
    };

    const applyHeight = (height: number) => {
      if (root) {
        root.style.bottom = "";
        root.style.top = pullsTop
          ? `${clamp(startBottom - height, VIEWPORT_PADDING, startBottom - minHeight)}px`
          : `${clamp(startTop, VIEWPORT_PADDING, window.innerHeight - VIEWPORT_PADDING - minHeight)}px`;
      }

      setOverlayHeight(height);
    };

    const onMM = (e: MouseEvent) => {
      e.preventDefault();
      if (resizesWidth) applyWidth(nextWidth(e.clientX));
      if (resizesHeight) applyHeight(nextHeight(e.clientY));
    };

    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      if (resizesWidth) applyWidth(nextWidth(e.touches[0].clientX));
      if (resizesHeight) applyHeight(nextHeight(e.touches[0].clientY));
    };

    const up = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMM);
      document.removeEventListener("mouseup", up);
      document.removeEventListener("touchmove", onTM);
      document.removeEventListener("touchend", up);
    };

    document.body.style.cursor = getResizeCursor(handle);
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMM);
    document.addEventListener("mouseup", up);
    document.addEventListener("touchmove", onTM, { passive: false });
    document.addEventListener("touchend", up);
  };

  return { overlayWidth, overlayHeight, startResize };
}

function getResizeCursor(handle: ResizeHandle): string {
  if (handle === "top-left" || handle === "bottom-right") return "nwse-resize";
  if (handle === "top-right" || handle === "bottom-left") return "nesw-resize";
  if (handle === "left" || handle === "right") return "ew-resize";
  return "ns-resize";
}
