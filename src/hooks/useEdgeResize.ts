import { useState } from "react";

type ResizeEdge = "left" | "right";

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

  const startResize = (edge: ResizeEdge, clientX: number) => {
    const root = document.getElementById(rootId) as HTMLElement | null;
    const rect = getOverlayRect(rootId);
    if (!rect) return;

    const startX = clientX;
    const startWidth = Math.max(minWidth, rect.width || overlayWidth);
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
    const maxWidth = edge === "left"
      ? Math.max(minWidth, startRight - VIEWPORT_PADDING)
      : Math.max(minWidth, window.innerWidth - VIEWPORT_PADDING - startLeft);

    const nextWidth = (currentX: number) => {
      const delta = edge === "left" ? startX - currentX : currentX - startX;
      return clamp(startWidth + delta, minWidth, maxWidth);
    };

    const applyWidth = (width: number) => {
      if (root) {
        root.style.right = "";
        root.style.left = edge === "left"
          ? `${clamp(startRight - width, VIEWPORT_PADDING, startRight - minWidth)}px`
          : `${clamp(startLeft, VIEWPORT_PADDING, window.innerWidth - VIEWPORT_PADDING - minWidth)}px`;
      }

      setOverlayWidth(width);
    };

    const onMM = (e: MouseEvent) => {
      e.preventDefault();
      applyWidth(nextWidth(e.clientX));
    };

    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      applyWidth(nextWidth(e.touches[0].clientX));
    };

    const up = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMM);
      document.removeEventListener("mouseup", up);
      document.removeEventListener("touchmove", onTM);
      document.removeEventListener("touchend", up);
    };

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMM);
    document.addEventListener("mouseup", up);
    document.addEventListener("touchmove", onTM, { passive: false });
    document.addEventListener("touchend", up);
  };

  return { overlayWidth, startResize };
}
