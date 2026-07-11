"use client";

import { useRef, useState } from "react";
import Icon from "@/components/ui/Icon";

const SCROLL_COMPLETE_THRESHOLD_PX = 24;

const RESOURCE_ICON = {
  video: "play_circle",
  article: "article",
  docs: "menu_book",
  course: "school",
  practice: "fitness_center",
};

/**
 * One learning module — in-app lesson (explanation, steps, examples, checks)
 * plus real curated/search resources for that skill. Complete via scroll
 * confirm or the manual checkbox.
 */
export default function LessonModule({ module, done, isToggling, onToggle }) {
  const [open, setOpen] = useState(false);
  const [revealedChecks, setRevealedChecks] = useState({});
  const [scrollPrompt, setScrollPrompt] = useState(false);
  const promptedRef = useRef(false);

  const handleScroll = (e) => {
    if (promptedRef.current || done) return;
    const el = e.target;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_COMPLETE_THRESHOLD_PX;
    if (atBottom) {
      promptedRef.current = true;
      setScrollPrompt(true);
    }
  };

  const confirmScrollComplete = () => {
    setScrollPrompt(false);
    onToggle(true, "scroll_complete");
  };

  const dismissScrollPrompt = () => setScrollPrompt(false);

  const toggleCheck = (i) => setRevealedChecks((prev) => ({ ...prev, [i]: !prev[i] }));

  const resources = module.resources || [];
  const explanation = module.explanation || module.description || "";

  return (
    <div
      className={`card-hover overflow-hidden rounded-2xl border bg-white transition-all ${
        done ? "border-outline-variant opacity-80" : "border-outline-variant"
      }`}
    >
      <div className="flex items-center gap-4 p-5">
        <button
          type="button"
          onClick={() => onToggle()}
          disabled={isToggling}
          aria-label={done ? "Mark incomplete" : "Mark complete"}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
            done ? "bg-primary text-on-primary" : "border-2 border-dashed border-outline-variant text-outline hover:border-primary"
          }`}
        >
          <Icon name={done ? "check" : isToggling ? "hourglass_empty" : "radio_button_unchecked"} size={20} />
        </button>

        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
          <div className="min-w-0 flex-1">
            <p className={`text-label-sm font-bold uppercase tracking-wider ${done ? "text-secondary" : "text-primary"}`}>
              {module.skill}
            </p>
            <p className="text-body-md font-semibold text-on-surface">{module.title}</p>
            {resources.length > 0 && (
              <p className="mt-0.5 text-xs text-secondary">
                {resources.length} resource{resources.length === 1 ? "" : "s"}
              </p>
            )}
          </div>
          <Icon name="expand_more" className={`shrink-0 text-secondary transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="border-t border-outline-variant/40">
          <div onScroll={handleScroll} className="max-h-[420px] space-y-5 overflow-y-auto p-5 pt-4">
            <div className="space-y-3 text-body-md leading-relaxed text-on-surface-variant">
              {explanation
                .split("\n")
                .filter((p) => p.trim())
                .map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              {!explanation && (
                <p className="italic text-secondary">No lesson content yet for this module.</p>
              )}
            </div>

            {module.steps?.length > 0 && (
              <div>
                <p className="mb-2 text-label-sm font-bold uppercase tracking-wider text-secondary">Steps</p>
                <ol className="list-decimal space-y-1.5 pl-5 text-body-md text-on-surface">
                  {module.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {module.examples?.length > 0 && (
              <div>
                <p className="mb-2 text-label-sm font-bold uppercase tracking-wider text-secondary">Examples</p>
                <div className="space-y-2">
                  {module.examples.map((ex, i) => (
                    <pre key={i} className="whitespace-pre-wrap rounded-xl bg-surface-container-lowest p-4 font-mono text-sm text-on-surface">
                      {ex}
                    </pre>
                  ))}
                </div>
              </div>
            )}

            {module.mini_checks?.length > 0 && (
              <div>
                <p className="mb-2 text-label-sm font-bold uppercase tracking-wider text-secondary">Quick Check</p>
                <div className="space-y-2">
                  {module.mini_checks.map((check, i) => (
                    <div key={i} className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4">
                      <p className="text-body-md font-semibold text-on-surface">{check.question}</p>
                      {revealedChecks[i] ? (
                        <p className="mt-2 text-sm text-secondary">{check.answer}</p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleCheck(i)}
                          className="mt-2 text-xs font-bold text-primary hover:underline"
                        >
                          Reveal answer
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resources.length > 0 && (
              <div>
                <p className="mb-2 text-label-sm font-bold uppercase tracking-wider text-secondary">
                  Study resources
                </p>
                <div className="space-y-2">
                  {resources.map((res) => (
                    <a
                      key={res.url}
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 transition-colors hover:bg-surface-container-low"
                    >
                      <Icon
                        name={RESOURCE_ICON[res.type] || "link"}
                        size={18}
                        className="shrink-0 text-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-on-surface">{res.title}</p>
                        <p className="truncate text-xs text-secondary">
                          {res.provider}
                          {res.duration ? ` • ${res.duration}` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          res.cost === "paid"
                            ? "bg-tertiary-fixed text-on-tertiary-fixed"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {res.cost || "free"}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="h-1" />
          </div>

          {scrollPrompt && !done && (
            <div className="flex items-center justify-between gap-3 border-t border-primary/20 bg-primary/5 px-5 py-4">
              <p className="text-sm font-semibold text-on-surface">Finished this lesson?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmScrollComplete}
                  className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-on-primary hover:bg-primary-container"
                >
                  Yes, mark complete
                </button>
                <button
                  type="button"
                  onClick={dismissScrollPrompt}
                  className="rounded-lg border border-outline-variant px-4 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-low"
                >
                  Not yet
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
