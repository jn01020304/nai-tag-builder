import { useState } from "react";

export function useEdgeResize(minWidth: number) {
  const [overlayWidth, setOverlayWidth] = useState(minWidth);

  const startResize = (clientX: number) => {
    let startX = clientX;
    let startWidth = overlayWidth;

    const onMM = (e: MouseEvent) => {
      e.preventDefault();
      setOverlayWidth(Math.max(minWidth, startWidth + (e.clientX - startX)));
    };

    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      setOverlayWidth(Math.max(minWidth, startWidth + (e.touches[0].clientX - startX)));
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
