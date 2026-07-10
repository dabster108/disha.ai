"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import InterviewReportCard from "@/components/interview/InterviewReportCard";
import { useProfile } from "@/context/ProfileContext";
import { getInterviewHistory } from "@/lib/api";

export default function InterviewReportPage() {
  const { profileId } = useProfile();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const sessions = await getInterviewHistory(profileId);
      const found = sessions.find((s) => s.id === sessionId);
      if (!found) {
        setError(new Error("Interview session not found."));
        return;
      }
      setSession(found);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profileId && sessionId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, sessionId]);

  if (loading) return <LoadingState label="Loading report..." />;
  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-12">
        <ErrorBanner message={error.message} onRetry={load} />
      </div>
    );
  }
  if (!session) return null;

  return (
    <div className="min-h-screen p-6 md:p-12">
      <header className="mb-10 mask-reveal print:hidden">
        <nav className="mb-4 flex items-center gap-2 text-secondary">
          <Link href="/mock-interview" className="text-label-sm hover:text-primary">
            Mock Interview
          </Link>
          <Icon name="chevron_right" className="text-xs" />
          <span className="text-label-sm text-on-surface">Report Card</span>
        </nav>
      </header>

      <InterviewReportCard session={session} />
    </div>
  );
}
