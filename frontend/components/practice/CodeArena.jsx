"use client";

import { useRef, useEffect } from "react";
import Icon from "@/components/ui/Icon";

export default function CodeArena({
  value,
  onChange,
  language,
  explanation,
  onExplanationChange,
  placeholder = "Write your code here...",
  disabled = false,
}) {
  const lineNumbersRef = useRef(null);
  const textareaRef = useRef(null);

  const lines = value.split("\n");
  const lineCount = Math.max(12, lines.length);

  const handleScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // Sync scroll height when content changes
  useEffect(() => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, [value]);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="flex items-center gap-2 text-label-md font-bold text-on-surface">
            <Icon name="code" size={18} />
            Your Solution
          </label>
          {language && (
            <span className="rounded bg-primary/10 px-2.5 py-1 text-label-sm font-bold uppercase tracking-wider text-primary">
              {language}
            </span>
          )}
        </div>
        
        <div className="flex font-mono text-sm border border-outline-variant rounded-xl overflow-hidden bg-surface-container-lowest focus-within:border-primary">
          {/* Line numbers column */}
          <div
            ref={lineNumbersRef}
            className="select-none border-r border-outline-variant bg-surface-container-low px-3 py-5 text-right text-secondary text-xs overflow-hidden leading-6"
            style={{ height: "300px" }}
          >
            {Array.from({ length: lineCount }).map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          
          {/* Code Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            disabled={disabled}
            rows={12}
            spellCheck={false}
            placeholder={placeholder}
            className="w-full resize-none bg-transparent p-5 font-mono text-sm leading-6 text-on-surface focus:outline-none disabled:opacity-60"
            style={{ height: "300px" }}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-label-md font-bold text-on-surface">
          Explanation (optional)
        </label>
        <textarea
          value={explanation}
          onChange={(e) => onExplanationChange(e.target.value)}
          disabled={disabled}
          rows={3}
          placeholder="Briefly explain your approach, time complexity, or choices..."
          className="w-full rounded-xl border border-outline-variant p-4 text-body-md focus:border-primary focus:outline-none disabled:opacity-60 bg-white"
        />
      </div>
    </div>
  );
}
