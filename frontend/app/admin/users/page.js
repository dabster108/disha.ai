"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { getAdminUsers } from "@/lib/adminApi";

const STATUS_STYLE = {
  verified: "bg-green-100 text-green-700",
  needs_review: "bg-amber-100 text-amber-700",
  flagged: "bg-red-100 text-red-700",
};

function StatusBadge({ status }) {
  if (!status) return <span className="text-xs text-secondary">—</span>;
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_STYLE[status] || "bg-surface-container text-secondary"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function ActivityDot({ on, label }) {
  return (
    <span
      title={label}
      className={`inline-flex h-2 w-2 rounded-full ${on ? "bg-primary" : "bg-outline-variant"}`}
    />
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = (query) => {
    setLoading(true);
    setError(null);
    getAdminUsers({ limit: 100, q: query })
      .then(setUsers)
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(() => load(""), []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-display-lg text-on-surface">Users</h1>
          <p className="mt-1 text-body-md text-secondary">{users.length} profiles</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(q);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, role..."
            className="w-64 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <button type="submit" className="rounded-xl bg-on-surface px-4 py-2 text-sm font-bold text-white">
            Search
          </button>
        </form>
      </header>

      {error && <ErrorBanner message={error.message} onRetry={() => load(q)} />}
      {loading ? (
        <LoadingState label="Loading users..." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-outline-variant bg-surface-container-lowest text-xs uppercase tracking-wider text-secondary">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Readiness</th>
                <th className="px-5 py-3">Activity</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container-lowest">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-on-surface">{u.full_name || "Anonymous"}</p>
                    <p className="text-xs text-secondary">{u.email || "—"}</p>
                  </td>
                  <td className="px-5 py-3 text-secondary">{u.target_role}</td>
                  <td className="px-5 py-3 font-bold text-on-surface">
                    {u.readiness_score != null ? `${Math.round(u.readiness_score)}%` : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1.5">
                      <ActivityDot on={u.has_gap} label="Skill gap" />
                      <ActivityDot on={u.has_interview} label="Interview" />
                      <ActivityDot on={u.has_practice} label="Practice" />
                      <ActivityDot on={u.has_roadmap} label="Roadmap" />
                    </div>
                  </td>
                  <td className="px-5 py-3 text-secondary">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={u.verification_status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/admin/users/${u.id}`} className="text-primary hover:underline">
                      <Icon name="chevron_right" size={20} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <p className="p-8 text-center text-sm text-secondary">No users found.</p>}
        </div>
      )}
    </div>
  );
}
