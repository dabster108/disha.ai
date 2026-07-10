"use client";

import Icon from "@/components/ui/Icon";

const columns = [
  {
    id: "saved",
    title: "Saved",
    color: "border-secondary",
    jobs: [
      { company: "Google", title: "Frontend Engineer", location: "Remote" },
    ],
  },
  {
    id: "applied",
    title: "Applied",
    color: "border-primary",
    jobs: [
      {
        company: "Leapfrog",
        title: "Senior Frontend Engineer",
        location: "Kathmandu",
        date: "Applied 3 days ago",
      },
      {
        company: "Fusemachines",
        title: "React Developer",
        location: "Lalitpur",
        date: "Applied 1 week ago",
      },
    ],
  },
  {
    id: "interview",
    title: "Interview",
    color: "border-tertiary",
    jobs: [
      {
        company: "Deerwalk",
        title: "Junior Frontend Dev",
        location: "Lalitpur",
        date: "Interview Oct 15",
      },
    ],
  },
  {
    id: "offer",
    title: "Offer",
    color: "border-green-500",
    jobs: [],
  },
  {
    id: "rejected",
    title: "Rejected",
    color: "border-error",
    jobs: [
      {
        company: "Cotiviti",
        title: "React Developer",
        location: "Kathmandu",
        date: "Rejected 2 weeks ago",
      },
    ],
  },
];

export default function ApplicationsPage() {
  return (
    <div className="min-h-screen p-12">
      <header className="mb-12 mask-reveal">
        <h1 className="text-display-lg text-on-surface">Application Tracker</h1>
        <p className="mt-2 max-w-2xl text-body-lg text-secondary">
          Track your hiring journey from saved jobs to offers.
        </p>
      </header>

      <div className="flex gap-6 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div
            key={col.id}
            className="w-72 shrink-0 rounded-2xl border border-outline-variant bg-surface-container-low p-4"
          >
            <div className={`mb-4 flex items-center gap-2 border-b-2 pb-3 ${col.color}`}>
              <h3 className="text-label-md font-bold text-on-surface">
                {col.title}
              </h3>
              <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm text-secondary">
                {col.jobs.length}
              </span>
            </div>
            <div className="space-y-3">
              {col.jobs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-outline-variant p-6 text-center text-label-md text-secondary">
                  No applications
                </div>
              ) : (
                col.jobs.map((job) => (
                  <div
                    key={`${job.company}-${job.title}`}
                    className="cursor-pointer rounded-xl border border-outline-variant bg-white p-4 transition-all hover:border-primary hover:shadow-sm"
                  >
                    <h4 className="text-label-md font-bold text-on-surface">
                      {job.title}
                    </h4>
                    <p className="text-label-md text-secondary">{job.company}</p>
                    <div className="mt-2 flex items-center gap-1 text-label-sm text-outline">
                      <Icon name="location_on" size={14} />
                      {job.location}
                    </div>
                    {job.date && (
                      <p className="mt-2 text-label-sm text-secondary">
                        {job.date}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
