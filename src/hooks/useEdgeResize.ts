import { useState } from "react";

type ResizeEdge = "left" | "right";

function clampWidth(width: number, minWidth: number): number {
  const maxWidth = Math.max(minWidth, window.innerWidth - 16);
  return Math.min(maxWidth, Math.max(minWidth, width));
}

export function useEdgeResize(minWidth: number, edge: ResizeEdge = "right") {
  const [overlayWidth, setOverlayWidth] = useState(minWidth);

  const startResize = (clientX: number) => {
    const startX = clientX;
    const startWidth = overlayWidth;

    const nextWidth = (currentX: number) => {
      const delta = edge === "left" ? startX - currentX : currentX - startX;
      return clampWidth(startWidth + delta, minWidth);
    };

    const onMM = (e: MouseEvent) => {
      e.preventDefault();
      setOverlayWidth(nextWidth(e.clientX));
    };

    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      setOverlayWidth(nextWidth(e.touches[0].clientX));
    };

    const up = () => {
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMM);
      document.removeEventListener("mouseup", up);
      document.removeEventListener("touchmove", onTM);
      document.removeEventListener("touchend", up);
    };

    document.body.style.cursor = "ew-resize";
    document.addEventListener("mousemove", onMM);
    document.addEventListener("mouseup", up);
    document.addEventListener("touchmove", onTM, { passive: false });
    document.addEventListener("touchend", up);
  };

  return { overlayWidth, startResize };
}
