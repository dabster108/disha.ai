"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RoadmapNodeCard from "./RoadmapNodeCard";
import RoadmapConnectors, { layoutRoadmapCanvas } from "./RoadmapConnectors";
import RoadmapDetailPanel from "./RoadmapDetailPanel";
import { RoadmapZoomControls } from "./RoadmapProgressHeader";
import { useRoadmapCanvasControls } from "./useRoadmapCanvasControls";
import InAppResourceViewer from "@/components/learning/InAppResourceViewer";

export default function RoadmapCanvas({
  sections,
  nodes,
  onToggleNode,
  onToggleLegacy,
  onOpenLegacyResource,
  isResourceDone,
  togglingId,
  reducedMotion: reducedMotionProp,
}) {
  const scrollRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const [selectedNode, setSelectedNode] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeResource, setActiveResource] = useState(null);
  const [completingResource, setCompletingResource] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const {
    zoom,
    pan,
    prefersReducedMotion,
    zoomIn,
    zoomOut,
    resetView,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  } = useRoadmapCanvasControls(scrollRef);

  const reducedMotion = reducedMotionProp ?? prefersReducedMotion;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const layout = useMemo(
    () => layoutRoadmapCanvas(sections, { vertical: isMobile }),
    [sections, isMobile]
  );

  const openNode = useCallback((node) => {
    setSelectedNode(node);
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const handleToggleComplete = useCallback(
    async (markDone) => {
      if (!selectedNode) return;
      if (selectedNode.meta?.legacy) {
        await onToggleLegacy?.(selectedNode, markDone);
      } else {
        await onToggleNode?.(selectedNode.id, markDone);
      }
      if (!markDone) return;
      setPanelOpen(false);
    },
    [onToggleLegacy, onToggleNode, selectedNode]
  );

  const handleOpenResource = useCallback(
    (resource, resourceIndex) => {
      if (selectedNode?.meta?.legacy) {
        onOpenLegacyResource?.(selectedNode, resourceIndex, resource);
        return;
      }
      setActiveResource({
        resource,
        onDone: async () => {
          await onToggleNode?.(selectedNode.id, true);
          setActiveResource(null);
          setPanelOpen(false);
        },
      });
    },
    [onOpenLegacyResource, onToggleNode, selectedNode]
  );

  const handleResourceStudied = async () => {
    if (!activeResource?.onDone) return;
    setCompletingResource(true);
    try {
      await activeResource.onDone();
    } finally {
      setCompletingResource(false);
    }
  };

  const onCardKeyDown = (event, node, index) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openNode(node);
      return;
    }
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(nodes.length - 1, index + 1);
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
    if (next !== index) {
      event.preventDefault();
      const target = nodes[next];
      const el = nodeRefs.current.get(target.id);
      el?.focus();
    }
  };

  return (
    <div className="roadmap-canvas-shell relative">
      <p className="mb-3 text-xs text-secondary md:hidden">
        Swipe to explore · Tap a card for details
      </p>
      <p className="mb-3 hidden text-xs text-secondary md:block">
        Scroll horizontally · Shift+scroll · Ctrl+wheel to zoom · Drag empty space to pan
      </p>

      <div
        ref={scrollRef}
        className="roadmap-canvas-viewport relative overflow-auto rounded-3xl border border-outline-variant/60 bg-[radial-gradient(circle_at_1px_1px,#e2e3e1_1px,transparent_0)] bg-[length:24px_24px] shadow-inner"
        style={{ maxHeight: "min(72vh, 820px)", minHeight: "420px" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        role="list"
        aria-label="Roadmap canvas"
      >
        <div
          className="roadmap-canvas-stage relative origin-top-left"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: reducedMotion ? "none" : "transform 200ms ease-out",
          }}
        >
          <RoadmapConnectors nodes={nodes} positions={layout.positions} reducedMotion={reducedMotion} />

          {layout.sectionLabels.map((label) => (
            <div
              key={label.id}
              className="absolute max-w-[280px]"
              style={{ left: label.x, top: label.y }}
            >
              <span className="inline-flex max-w-full items-center rounded-full bg-inverse-surface px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-inverse-on-surface shadow-sm">
                <span className="truncate">{label.title}</span>
              </span>
            </div>
          ))}

          {nodes.map((node, index) => {
            const pos = layout.positions.get(node.id);
            if (!pos) return null;
            return (
              <div key={node.id} className="absolute" style={{ left: pos.x, top: pos.y }}>
                <RoadmapNodeCard
                  node={node}
                  index={index}
                  selected={selectedNode?.id === node.id && panelOpen}
                  onSelect={openNode}
                  onKeyDown={(e) => onCardKeyDown(e, node, index)}
                  cardRef={(el) => {
                    if (el) nodeRefs.current.set(node.id, el);
                    else nodeRefs.current.delete(node.id);
                  }}
                  reducedMotion={reducedMotion}
                />
              </div>
            );
          })}
        </div>
      </div>

      <RoadmapZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetView} />

      <RoadmapDetailPanel
        node={selectedNode}
        open={panelOpen}
        onClose={closePanel}
        onToggleComplete={handleToggleComplete}
        onOpenResource={handleOpenResource}
        isToggling={togglingId === selectedNode?.id}
        isResourceDone={(ri) => (selectedNode ? isResourceDone?.(selectedNode, ri) : false)}
        reducedMotion={reducedMotion}
      />

      <InAppResourceViewer
        key={activeResource?.resource?.url ?? "roadmap-resource"}
        resource={activeResource?.resource}
        onClose={() => setActiveResource(null)}
        onComplete={handleResourceStudied}
        completing={completingResource}
      />
    </div>
  );
}
