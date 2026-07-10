"use client";

export default function LiveTranscript({
  question,
  questionMeta,
  transcript,
  placeholder = "Your answer will appear here after you speak…",
  editable = false,
  onTranscriptChange,
}) {
  return (
    <div className="space-y-4">
      {question && (
        <div className="rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-5">
          {questionMeta && (
            <span className="mb-2 block text-label-sm uppercase tracking-wider text-primary">
              {questionMeta}
            </span>
          )}
          <p className="text-headline-md leading-snug text-on-surface">{question}</p>
        </div>
      )}

      <div
        className="min-h-[80px] rounded-xl border border-outline-variant/50 bg-white p-5"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="mb-2 block text-label-sm uppercase tracking-wider text-secondary">
          Your answer
        </span>
        {editable ? (
          <textarea
            value={transcript}
            onChange={(e) => onTranscriptChange?.(e.target.value)}
            rows={4}
            className="w-full resize-none bg-transparent text-body-md text-on-surface focus:outline-none"
            placeholder={placeholder}
          />
        ) : (
          <p className={`text-body-md ${transcript ? "text-on-surface" : "italic text-secondary"}`}>
            {transcript || placeholder}
          </p>
        )}
      </div>
    </div>
  );
}
