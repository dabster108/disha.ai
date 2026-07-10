import Icon from "@/components/ui/Icon";

export default function TopHeader({ searchPlaceholder = "Search roadmap, lessons..." }) {
  return (
    <header className="fixed left-64 right-0 top-0 z-40 flex h-[72px] items-center justify-between border-b border-outline-variant bg-surface/80 px-gutter backdrop-blur-md">
      <div className="flex w-96 items-center rounded-full bg-surface-container-low px-4 py-2">
        <Icon name="search" className="mr-2 text-secondary" size={20} />
        <input
          className="w-full border-none bg-transparent text-body-md focus:ring-0 focus:outline-none"
          placeholder={searchPlaceholder}
          type="text"
        />
      </div>
      <div className="flex items-center gap-6">
        <span className="text-label-md font-bold text-primary">
          Goal: Senior Developer
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-full p-2 text-secondary transition-colors hover:bg-surface-container-low"
            aria-label="Notifications"
          >
            <Icon name="notifications" size={20} />
          </button>
          <button
            type="button"
            className="rounded-full p-2 text-secondary transition-colors hover:bg-surface-container-low"
            aria-label="Career goal"
          >
            <Icon name="flag" size={20} />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed font-bold text-on-primary-fixed">
            P
          </div>
        </div>
      </div>
    </header>
  );
}
