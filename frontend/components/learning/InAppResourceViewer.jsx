"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";

const DWELL_THRESHOLD_MS = 45_000;

const HEADING_CLASSES = {
  1: "text-headline-sm font-bold text-on-surface",
  2: "text-body-lg font-bold text-on-surface",
  3: "text-body-md font-bold text-on-surface",
  4: "text-body-md font-bold text-on-surface",
};

const INLINE_TOKEN_RE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
const LINK_RE = /^\[([^\]]+)\]\(([^)]+)\)$/;

/** Splits one line of markdown-lite into text/bold/code React nodes. Links
 * are rendered as plain text (never anchors) — docs content never navigates
 * the student away from the Learning panel. */
function renderInline(text) {
  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  INLINE_TOKEN_RE.lastIndex = 0;
  while ((match = INLINE_TOKEN_RE.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(
        <code key={key++} className="rounded bg-surface-container-high px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const linkMatch = token.match(LINK_RE);
      parts.push(linkMatch ? linkMatch[1] : token);
    }
    lastIndex = INLINE_TOKEN_RE.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

const isBlank = (line) => !line.trim();
const isFence = (line) => line.trim().startsWith("```");
const isHeading = (line) => /^(#{1,4})\s+/.test(line);
const isBullet = (line) => /^\s*[-*]\s+/.test(line);
const isNumbered = (line) => /^\s*\d+\.\s+/.test(line);

/** Minimal, dependency-free markdown renderer for Context7 docs: headings,
 * fenced code blocks, bullet/numbered lists, paragraphs. No HTML injection
 * (no dangerouslySetInnerHTML) since this is third-party fetched content. */
function renderMarkdownLite(md) {
  const lines = (md || "").split("\n");
  const blocks = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isFence(line)) {
      const codeLines = [];
      i += 1;
      while (i < lines.length && !isFence(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre key={key++} className="whitespace-pre-wrap rounded-xl bg-surface-container-lowest p-4 font-mono text-sm text-on-surface">
          {codeLines.join("\n")}
        </pre>
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const Tag = `h${Math.min(level + 1, 4)}`;
      blocks.push(
        <Tag key={key++} className={HEADING_CLASSES[level] || HEADING_CLASSES[4]}>
          {renderInline(headingMatch[2])}
        </Tag>
      );
      i += 1;
      continue;
    }

    if (isBullet(line)) {
      const items = [];
      while (i < lines.length && isBullet(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={key++} className="list-disc space-y-1 pl-5 text-body-md text-on-surface-variant">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (isNumbered(line)) {
      const items = [];
      while (i < lines.length && isNumbered(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={key++} className="list-decimal space-y-1 pl-5 text-body-md text-on-surface-variant">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (isBlank(line)) {
      i += 1;
      continue;
    }

    const paraLines = [line];
    i += 1;
    while (i < lines.length && !isBlank(lines[i]) && !isFence(lines[i]) && !isHeading(lines[i]) && !isBullet(lines[i]) && !isNumbered(lines[i])) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={key++} className="leading-relaxed text-body-md text-on-surface-variant">
        {renderInline(paraLines.join(" "))}
      </p>
    );
  }

  return blocks;
}

function formatRemaining(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${seconds}s`;
}

/**
 * In-app viewer for one Learning-panel resource — YouTube embed or Context7
 * markdown docs. Never opens a new tab. Tracks dwell time while the panel is
 * open (not tab visibility) and prompts to mark the resource studied once
 * ``DWELL_THRESHOLD_MS`` has passed.
 */
export default function InAppResourceViewer({ resource, onClose, onComplete, completing }) {
  const [remainingMs, setRemainingMs] = useState(DWELL_THRESHOLD_MS);
  const [dwellPrompted, setDwellPrompted] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const openedAtRef = useRef(null);

  // Dwell state resets per-resource via the caller's `key={resource.url}` remount, not here.
  useEffect(() => {
    if (!resource) return undefined;
    openedAtRef.current = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - openedAtRef.current;
      const remaining = DWELL_THRESHOLD_MS - elapsed;
      setRemainingMs(remaining);
      if (remaining <= 0) {
        setDwellPrompted(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [resource]);

  if (!resource) return null;

  const showConfirmBanner = dwellPrompted && !promptDismissed;

  const handleConfirm = async () => {
    await onComplete?.(resource);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={resource.title}
      >
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/40 p-5">
          <div className="min-w-0">
            <p className="text-label-sm font-bold uppercase tracking-wider text-primary">{resource.provider}</p>
            <p className="truncate text-body-lg font-semibold text-on-surface">{resource.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1.5 text-secondary hover:bg-surface-container-low hover:text-on-surface"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {resource.consume === "embed" && resource.embed_url && (
            <div className="aspect-video w-full bg-black">
              <iframe
                key={resource.embed_url}
                src={resource.embed_url}
                title={resource.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          )}

          {resource.consume === "markdown" && (
            <div className="space-y-3 p-6">
              {resource.content_md ? (
                renderMarkdownLite(resource.content_md)
              ) : (
                <p className="italic text-secondary">No docs content available.</p>
              )}
            </div>
          )}

          {resource.consume !== "embed" && resource.consume !== "markdown" && (
            <p className="p-6 italic text-secondary">This resource can&apos;t be opened in-app yet.</p>
          )}
        </div>

        {showConfirmBanner ? (
          <div className="flex items-center justify-between gap-3 border-t border-primary/20 bg-primary/5 px-5 py-4">
            <p className="text-sm font-semibold text-on-surface">Finished studying this?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={completing}
                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-on-primary hover:bg-primary-container disabled:opacity-60"
              >
                {completing ? "Saving..." : "Yes, mark complete"}
              </button>
              <button
                type="button"
                onClick={() => setPromptDismissed(true)}
                className="rounded-lg border border-outline-variant px-4 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-low"
              >
                Not yet
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 border-t border-outline-variant/40 px-5 py-3">
            <p className="text-xs text-secondary">
              {remainingMs > 0 ? `Studying — mark done unlocks in ${formatRemaining(remainingMs)}` : "Studying..."}
            </p>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={completing}
              className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-low disabled:opacity-60"
            >
              {completing ? "Saving..." : "Mark done now"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
