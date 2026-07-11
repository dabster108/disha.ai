"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

export function useRoadmapCanvasControls(containerRef) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clampZoom = useCallback((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)), []);

  const zoomIn = useCallback(() => setZoom((z) => clampZoom(Number((z + ZOOM_STEP).toFixed(2)))), [clampZoom]);
  const zoomOut = useCallback(() => setZoom((z) => clampZoom(Number((z - ZOOM_STEP).toFixed(2)))), [clampZoom]);
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const onWheel = useCallback(
    (event) => {
      const el = containerRef.current;
      if (!el) return;

      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setZoom((z) => clampZoom(Number((z + delta).toFixed(2))));
        return;
      }

      const horizontal = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
      if (horizontal) {
        event.preventDefault();
        el.scrollLeft += event.shiftKey ? event.deltaY : event.deltaX;
      }
    },
    [clampZoom, containerRef]
  );

  const onPointerDown = useCallback((event) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (target.closest("[data-roadmap-card]") || target.closest("[data-roadmap-panel]")) return;
    dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [pan.x, pan.y]);

  const onPointerMove = useCallback((event) => {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [containerRef, onWheel]);

  return {
    zoom,
    pan,
    prefersReducedMotion,
    zoomIn,
    zoomOut,
    resetView,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
