import EmptyState from "@/components/ui/EmptyState";

export default function ApplicationsPage() {
  return (
    <div className="min-h-screen p-12">
      <header className="mb-12">
        <h1 className="text-display-lg text-on-surface">Application Tracker</h1>
        <p className="mt-2 max-w-2xl text-body-lg text-secondary">
          Track your hiring journey from saved jobs to offers.
        </p>
      </header>

      <EmptyState
        icon="assignment"
        title="Application tracking is coming soon"
        description="Complete your profile journey first — job matching and application tracking will connect here next."
        actionLabel="View Job Matches"
        actionHref="/jobs"
      />
    </div>
  );
}
