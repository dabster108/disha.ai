"use client";

import { useEffect, useState } from "react";

const CARD_WIDTH = 280;
const CARD_HEIGHT = 168;
const SECTION_GAP_X = 96;
const NODE_GAP_Y = 40;
const SECTION_HEADER = 48;
const PADDING = 48;

export function layoutRoadmapCanvas(sections, { vertical = false } = {}) {
  const positions = new Map();
  const sectionLabels = [];
  let maxX = PADDING;
  let maxY = PADDING;

  if (vertical) {
    let cursorY = PADDING;
    sections.forEach((section) => {
      sectionLabels.push({
        id: section.id,
        title: section.title,
        x: PADDING,
        y: cursorY,
      });
      cursorY += SECTION_HEADER;
      section.nodes.forEach((node, nodeIndex) => {
        const x = PADDING;
        const y = cursorY + nodeIndex * (CARD_HEIGHT + NODE_GAP_Y);
        positions.set(node.id, {
          x,
          y,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          centerX: x + CARD_WIDTH / 2,
          centerY: y + CARD_HEIGHT / 2,
          sectionId: section.id,
        });
        maxX = Math.max(maxX, x + CARD_WIDTH);
        maxY = Math.max(maxY, y + CARD_HEIGHT);
      });
      cursorY += section.nodes.length * (CARD_HEIGHT + NODE_GAP_Y) + SECTION_GAP_X;
    });
  } else {
    let sectionX = PADDING;
    sections.forEach((section) => {
      const nodeCount = section.nodes.length;
      const branchCols = nodeCount > 4 ? 2 : 1;
      const rows = Math.ceil(nodeCount / branchCols) || 1;
      const sectionWidth = branchCols * CARD_WIDTH + (branchCols - 1) * 24;

      sectionLabels.push({
        id: section.id,
        title: section.title,
        x: sectionX,
        y: PADDING,
      });

      section.nodes.forEach((node, nodeIndex) => {
        const col = nodeIndex % branchCols;
        const row = Math.floor(nodeIndex / branchCols);
        const x = sectionX + col * (CARD_WIDTH + 24);
        const y = PADDING + SECTION_HEADER + row * (CARD_HEIGHT + NODE_GAP_Y);
        positions.set(node.id, {
          x,
          y,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          centerX: x + CARD_WIDTH / 2,
          centerY: y + CARD_HEIGHT / 2,
          sectionId: section.id,
        });
        maxX = Math.max(maxX, x + CARD_WIDTH);
        maxY = Math.max(maxY, y + CARD_HEIGHT);
      });

      sectionX += sectionWidth + SECTION_GAP_X;
      maxX = Math.max(maxX, sectionX);
    });
  }

  return {
    positions,
    sectionLabels,
    width: maxX + PADDING,
    height: maxY + PADDING,
    constants: { CARD_WIDTH, CARD_HEIGHT, SECTION_GAP_X, NODE_GAP_Y, SECTION_HEADER, PADDING },
  };
}

function edgePoint(from, to) {
  const dx = to.centerX - from.centerX;
  const dy = to.centerY - from.centerY;
  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      x1: dx > 0 ? from.x + from.width : from.x,
      y1: from.centerY,
      x2: dx > 0 ? to.x : to.x + to.width,
      y2: to.centerY,
    };
  }
  return {
    x1: from.centerX,
    y1: dy > 0 ? from.y + from.height : from.y,
    x2: to.centerX,
    y2: dy > 0 ? to.y : to.y + to.height,
  };
}

export default function RoadmapConnectors({ nodes, positions, reducedMotion = false }) {
  const [paths, setPaths] = useState([]);

  useEffect(() => {
    const next = [];
    for (let i = 0; i < nodes.length - 1; i += 1) {
      const from = positions.get(nodes[i].id);
      const to = positions.get(nodes[i + 1].id);
      if (!from || !to) continue;
      const { x1, y1, x2, y2 } = edgePoint(from, to);
      const mx = (x1 + x2) / 2;
      const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
      const completed = nodes[i].isCompleted;
      next.push({ id: `${nodes[i].id}-${nodes[i + 1].id}`, d, completed });
    }
    setPaths(next);
  }, [nodes, positions]);

  if (!paths.length) return null;

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      {paths.map((path) => (
        <path
          key={path.id}
          d={path.d}
          fill="none"
          strokeWidth={2.5}
          strokeLinecap="round"
          className={[
            "roadmap-connector transition-all duration-500",
            path.completed ? "stroke-emerald-400" : "stroke-outline-variant/80",
            reducedMotion ? "" : path.completed ? "roadmap-connector-done" : "",
          ].join(" ")}
          strokeDasharray={path.completed ? "none" : "6 8"}
        />
      ))}
    </svg>
  );
}

export { CARD_WIDTH, CARD_HEIGHT, SECTION_GAP_X, NODE_GAP_Y, SECTION_HEADER, PADDING };
