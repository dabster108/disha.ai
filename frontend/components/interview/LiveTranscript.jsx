"use client";

export default function LiveTranscript({
  question,
  questionMeta,
  dishaCaption,
  dishaCaptionLabel = "DISHA",
  transcript,
  liveUserCaption,
  placeholder = "Your answer will appear here after you speak…",
  editable = false,
  onTranscriptChange,
}) {
  return (
    <div className="space-y-4">
      {(dishaCaption || question) && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5" aria-live="polite">
          <span className="mb-2 block text-label-sm font-bold uppercase tracking-wider text-primary">
            {dishaCaptionLabel}
          </span>
          {dishaCaption && (
            <p className="mb-3 text-body-md leading-relaxed text-on-surface">{dishaCaption}</p>
          )}
          {question && (
            <>
              {questionMeta && (
                <span className="mb-2 block text-label-sm uppercase tracking-wider text-secondary">
                  {questionMeta}
                </span>
              )}
              <p className="text-headline-md leading-snug text-on-surface">{question}</p>
            </>
          )}
        </div>
      )}

      <div
        className="min-h-[88px] rounded-xl border border-outline-variant/50 bg-white p-5"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="mb-2 block text-label-sm font-bold uppercase tracking-wider text-secondary">
          You
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
          <p
            className={`text-body-md leading-relaxed ${
              transcript || liveUserCaption ? "text-on-surface" : "italic text-secondary"
            }`}
          >
            {transcript || liveUserCaption || placeholder}
          </p>
        )}
      </div>
    </div>
  );
}
