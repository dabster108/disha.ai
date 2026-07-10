import Link from "next/link";
import Icon from "@/components/ui/Icon";

export default function EmptyState({
  icon = "info",
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon name={icon} size={28} />
      </div>
      <div>
        <h3 className="text-headline-md text-on-surface">{title}</h3>
        {description && <p className="mt-2 max-w-md text-body-md text-secondary">{description}</p>}
      </div>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-2 rounded-xl bg-primary px-6 py-3 text-label-md font-bold text-on-primary transition-all hover:bg-primary-container"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 rounded-xl bg-primary px-6 py-3 text-label-md font-bold text-on-primary transition-all hover:bg-primary-container"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
