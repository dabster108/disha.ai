"use client";

export default function SpeakingWaveform({ active = false, bars = 5, color = "bg-primary" }) {
  return (
    <div className="flex h-10 items-end justify-center gap-1" aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`w-1 rounded-full transition-all ${color} ${
            active ? "animate-pulse" : "opacity-30"
          }`}
          style={{
            height: active ? `${12 + (i % 3) * 10}px` : "8px",
            animationDelay: `${i * 0.12}s`,
            animationDuration: "0.6s",
          }}
        />
      ))}
    </div>
  );
}
