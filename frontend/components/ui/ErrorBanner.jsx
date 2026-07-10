import Icon from "@/components/ui/Icon";

export default function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-error/20 bg-error-container/40 p-5">
      <Icon name="error" className="text-error" />
      <p className="flex-1 text-body-md text-on-error-container">
        {message || "Something went wrong."}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-error/30 px-4 py-2 text-label-md font-bold text-error transition-colors hover:bg-error/10"
        >
          Retry
        </button>
      )}
    </div>
  );
}
