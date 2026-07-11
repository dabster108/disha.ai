"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import InterviewReportCard from "@/components/interview/InterviewReportCard";
import { getAdminInterview } from "@/lib/adminApi";
import { CACHE_TTL, loadWithCache, readCache } from "@/lib/resource-cache";

export default function AdminInterviewDetailPage({ params }) {
  const { sessionId } = use(params);
  const cacheKey = `admin:interview:${sessionId}`;
  const initial = readCache(cacheKey);
  const [session, setSession] = useState(initial.data);
  const [loading, setLoading] = useState(!initial.data);
  const [error, setError] = useState(null);

  const load = () => {
    if (!session) setLoading(true);
    setError(null);
    loadWithCache(cacheKey, () => getAdminInterview(sessionId), CACHE_TTL.adminDetail)
      .then(setSession)
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(load, [sessionId]);

  if (loading && !session) return <LoadingState label="Loading report..." />;
  if (error) return <ErrorBanner message={error.message} onRetry={load} />;
  if (!session) return null;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/interviews" className="mb-6 flex items-center gap-1 text-sm text-secondary hover:text-primary">
        <Icon name="arrow_back" size={16} />
        All interviews
      </Link>
      <InterviewReportCard session={session} showActions={false} />
    </div>
  );
}
