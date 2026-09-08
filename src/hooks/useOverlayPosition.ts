import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { TouchEvent as ReactTouchEvent } from "react";

const VIEWPORT_MARGIN = 8;

export interface OverlayPositionConfig {
  rootId: string;
  isCollapsed: boolean;
  overlayWidth: number;
  overlayHeight: number | null;
}

export interface OverlayPositionControls {
  viewportHeight: number;
  startDrag: (
    clientX: number,
    clientY: number,
    onActualDrag?: () => void,
  ) => void;
  handleTwoFingerDragStart: (event: ReactTouchEvent) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getTouchPoint(touches: {
  length: number;
  [index: number]: { clientX: number; clientY: number };
}): {
  clientX: number;
  clientY: number;
} {
  const touchCount = Math.max(1, touches.length);
  let clientX = 0;
  let clientY = 0;

  for (let index = 0; index < touchCount; index += 1) {
    clientX += touches[index].clientX;
    clientY += touches[index].clientY;
  }

  return {
    clientX: clientX / touchCount,
    clientY: clientY / touchCount,
  };
}

function clampOverlayPosition(
  element: HTMLElement,
  left: number,
  top: number,
): {
  left: number;
  top: number;
} {
  const rect = element.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft ?? 0;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportWidth = viewport?.width ?? window.innerWidth;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const minLeft = viewportLeft + VIEWPORT_MARGIN;
  const minTop = viewportTop + VIEWPORT_MARGIN;
  const maxLeft = Math.max(
    minLeft,
    viewportLeft + viewportWidth - rect.width - VIEWPORT_MARGIN,
  );
  const maxTop = Math.max(
    minTop,
    viewportTop + viewportHeight - rect.height - VIEWPORT_MARGIN,
  );

  return {
    left: clamp(left, minLeft, maxLeft),
    top: clamp(top, minTop, maxTop),
  };
}

function keepOverlayInViewport(rootId: string) {
  const root = document.getElementById(rootId) as HTMLElement | null;
  const overlay = root?.firstElementChild;
  if (!root || !(overlay instanceof HTMLElement)) return;

  const rect = overlay.getBoundingClientRect();
  const nextPosition = clampOverlayPosition(overlay, rect.left, rect.top);
  root.style.right = "";
  root.style.bottom = "";
  root.style.left = `${nextPosition.left}px`;
  root.style.top = `${nextPosition.top}px`;
}

export function useOverlayPosition({
  rootId,
  isCollapsed,
  overlayWidth,
  overlayHeight,
}: OverlayPositionConfig): OverlayPositionControls {
  const [viewportHeight, setViewportHeight] = useState(
    () => window.visualViewport?.height ?? window.innerHeight,
  );
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const startDrag = useCallback((
    clientX: number,
    clientY: number,
    onActualDrag?: () => void,
  ) => {
    dragCleanupRef.current?.();

    const element = document.getElementById(rootId) as HTMLElement | null;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const initialPosition = clampOverlayPosition(element, rect.left, rect.top);
    element.style.right = "";
    element.style.left = `${initialPosition.left}px`;
    element.style.top = `${initialPosition.top}px`;

    let lastX = clientX;
    let lastY = clientY;
    let hasDragged = false;

    const move = (currentX: number, currentY: number) => {
      if (!hasDragged && Math.hypot(currentX - clientX, currentY - clientY) > 5) {
        hasDragged = true;
        onActualDrag?.();
      }

      const nextPosition = clampOverlayPosition(
        element,
        Number.parseFloat(element.style.left) + currentX - lastX,
        Number.parseFloat(element.style.top) + currentY - lastY,
      );
      element.style.left = `${nextPosition.left}px`;
      element.style.top = `${nextPosition.top}px`;
      lastX = currentX;
      lastY = currentY;
    };

    const handleMouseMove = (event: MouseEvent) => {
      move(event.clientX, event.clientY);
    };
    const handleTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      const point = getTouchPoint(event.touches);
      move(point.clientX, point.clientY);
    };
    const cleanup = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", cleanup);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", cleanup);
      document.removeEventListener("touchcancel", cleanup);
      if (dragCleanupRef.current === cleanup) {
        dragCleanupRef.current = null;
      }
    };

    dragCleanupRef.current = cleanup;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", cleanup);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", cleanup);
    document.addEventListener("touchcancel", cleanup);
  }, [rootId]);

  const handleTwoFingerDragStart = useCallback((event: ReactTouchEvent) => {
    if (event.touches.length < 2) return;
    if ((event.target as Element).closest("[data-overlay-resize-handle='true']")) return;

    event.preventDefault();
    event.stopPropagation();
    const point = getTouchPoint(event.touches);
    startDrag(point.clientX, point.clientY);
  }, [startDrag]);

  useLayoutEffect(() => {
    keepOverlayInViewport(rootId);
  }, [isCollapsed, overlayHeight, overlayWidth, rootId, viewportHeight]);

  useLayoutEffect(() => {
    const handleViewportChange = () => {
      setViewportHeight(window.visualViewport?.height ?? window.innerHeight);
      keepOverlayInViewport(rootId);
    };
    window.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("scroll", handleViewportChange);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    };
  }, [rootId]);

  useEffect(() => () => {
    dragCleanupRef.current?.();
  }, []);

  return {
    viewportHeight,
    startDrag,
    handleTwoFingerDragStart,
  };
}
