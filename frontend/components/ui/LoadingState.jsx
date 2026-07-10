import Icon from "@/components/ui/Icon";

export default function LoadingState({ label = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-secondary">
      <Icon name="progress_activity" className="animate-spin text-3xl text-primary" />
      <p className="text-label-md">{label}</p>
    </div>
  );
}
