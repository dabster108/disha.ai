"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

/** One chat bubble. Memoized so the growing message list doesn't re-render
 *  every existing bubble when a new message or interim update arrives. */
function ChatBubbleBase({ role, text, kind, score, pending }) {
  const isUser = role === "user";
  const isSummary = kind === "summary";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-body-md leading-relaxed sm:max-w-[75%]",
          isUser
            ? "rounded-br-sm bg-primary text-on-primary"
            : isSummary
              ? "rounded-bl-sm border border-primary/30 bg-primary/5 text-on-surface"
              : "rounded-bl-sm bg-surface-container-high text-on-surface",
          pending && "opacity-70"
        )}
      >
        {!isUser && (
          <p className="mb-1 flex items-center gap-2 text-label-sm font-semibold uppercase tracking-wider text-primary">
            DISHA
            {isSummary && score != null && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                {score}/10
              </span>
            )}
            {isSummary && (
              <span className="text-[11px] font-bold normal-case tracking-normal text-secondary">
                Final analysis
              </span>
            )}
          </p>
        )}
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

export const ChatBubble = memo(ChatBubbleBase);
