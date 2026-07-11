import Icon from "@/components/ui/Icon";

/**
 * Plain-language summary — deliberately toned down from "AI Summary" +
 * auto_awesome marketing chrome, and placed after Learn Next/Standing since
 * it explains data the student has already seen, rather than leading with it.
 */
export default function CoachNote({ narrative, onGenerate, generating }) {
  if (narrative) {
    return (
      <section className="mb-16 mask-reveal rounded-xl border border-outline-variant bg-surface-container-low p-6">
        <p className="mb-3 text-label-sm font-bold uppercase tracking-wider text-secondary">Coach note</p>
        <p className="whitespace-pre-line text-body-md leading-relaxed text-on-surface-variant">{narrative}</p>
      </section>
    );
  }

  return (
    <button
      type="button"
      onClick={onGenerate}
      disabled={generating}
      className="mb-16 flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-dashed border-outline-variant bg-white px-5 py-4 text-left text-secondary transition-colors hover:bg-surface-container-low disabled:opacity-60"
    >
      <Icon name="chat" size={18} />
      <span className="text-label-md font-bold">
        {generating ? "Writing your coach note..." : "Get a plain-language summary"}
      </span>
    </button>
  );
}
