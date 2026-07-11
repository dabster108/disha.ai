"use client";

import { useEffect, useState } from "react";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import EmptyState from "@/components/ui/EmptyState";
import { LegacyRoadmapView, PathRoadmapView, isTaskDone } from "@/components/roadmap/RoadmapExperience";
import { resolveResourceConsume } from "@/lib/resourceConsume";
import { useProfile } from "@/context/ProfileContext";
import {
  createRoadmap,
  getLatestRoadmap,
  isNotFound,
  updateRoadmapNodeProgress,
  updateRoadmapProgress,
} from "@/lib/api";
import { CACHE_TTL, loadWithCache, readCache } from "@/lib/resource-cache";

export default function RoadmapPage() {
  const { profile, profileId } = useProfile();
  const cacheKey = `roadmap:${profileId}`;
  const initial = readCache(cacheKey);

  const [roadmap, setRoadmap] = useState(initial.data);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(!initial.data);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [needsGap, setNeedsGap] = useState(false);
  const [togglingNodeId, setTogglingNodeId] = useState(null);
  const [activeResource, setActiveResource] = useState(null);
  const [completingResource, setCompletingResource] = useState(false);

  const load = async () => {
    if (!profileId) return;
    if (!roadmap) setLoading(true);
    setError(null);
    setNeedsGap(false);
    try {
      const data = await loadWithCache(cacheKey, () => getLatestRoadmap(profileId), CACHE_TTL.roadmap);
      setRoadmap(data);
      setExpanded({ [data.weeks[0]?.week]: true });
    } catch (err) {
      if (isNotFound(err)) {
        await generateFresh();
      } else {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const generateFresh = async (opts = {}) => {
    setGenerating(true);
    setError(null);
    try {
      const data = await createRoadmap(profileId, opts);
      setRoadmap(data);
      setExpanded({ [data.weeks[0]?.week]: true });
    } catch (err) {
      if (isNotFound(err)) {
        setNeedsGap(true);
      } else {
        setError(err);
      }
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (profileId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const advanceIfWeekComplete = (updated, week) => {
    const weekObj = updated.weeks.find((w) => w.week === week);
    if (!weekObj) return;
    const doneInWeek = weekObj.tasks.filter((_, i) => isTaskDone(updated.progress, week, i)).length;
    if (doneInWeek === weekObj.tasks.length && weekObj.tasks.length > 0) {
      const nextWeek = updated.weeks.find((w) => w.week > week);
      setExpanded((prev) => ({
        ...prev,
        [week]: false,
        ...(nextWeek ? { [nextWeek.week]: true } : {}),
      }));
    }
  };

  const toggleTask = async (week, taskIndex) => {
    const markingDone = !isTaskDone(roadmap.progress, week, taskIndex);
    try {
      const updated = await updateRoadmapProgress(profileId, week, taskIndex, markingDone);
      setRoadmap(updated);
      if (markingDone) advanceIfWeekComplete(updated, week);
    } catch (err) {
      setError(err);
    }
  };

  const toggleResource = async (week, taskIndex, resourceIndex, forceDone) => {
    const markingDone =
      forceDone ??
      !((roadmap.progress?.resources_completed || []).some(
        (e) => e.week === week && e.task_index === taskIndex && e.resource_index === resourceIndex
      ));
    try {
      const updated = await updateRoadmapProgress(profileId, week, taskIndex, markingDone, resourceIndex);
      setRoadmap(updated);
      if (markingDone) advanceIfWeekComplete(updated, week);
    } catch (err) {
      setError(err);
    }
  };

  const toggleNode = async (nodeId, markingDone) => {
    setTogglingNodeId(nodeId);
    try {
      const updated = await updateRoadmapNodeProgress(profileId, nodeId, markingDone);
      setRoadmap(updated);
    } catch (err) {
      setError(err);
    } finally {
      setTogglingNodeId(null);
    }
  };

  const openTaskResource = (week, taskIndex, resourceIndex, resource) => {
    setActiveResource({
      resource: resolveResourceConsume(resource),
      onDone: () => toggleResource(week, taskIndex, resourceIndex, true),
    });
  };

  const handleResourceStudied = async () => {
    if (!activeResource) return;
    setCompletingResource(true);
    try {
      await activeResource.onDone();
      setActiveResource(null);
    } finally {
      setCompletingResource(false);
    }
  };

  if ((loading && !roadmap) || generating) {
    return <LoadingState label={generating ? "Generating your roadmap..." : "Loading roadmap..."} />;
  }

  if (needsGap) {
    return (
      <div className="p-12">
        <EmptyState
          icon="route"
          title="Run a skill gap analysis first"
          description="Your roadmap is built from your skill gap report — run that analysis first, then come back here."
          actionLabel="Go to Skill Gap"
          actionHref="/skill-gap"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12">
        <ErrorBanner message={error.message} onRetry={load} />
      </div>
    );
  }

  if (!roadmap) return null;

  return (
    <div className="roadmap-page mx-auto max-w-[1400px] px-4 py-8 md:px-8 md:py-12 lg:px-12">
      {roadmap.path ? (
        <PathRoadmapView
          roadmap={roadmap}
          profile={profile}
          onToggleNode={toggleNode}
          togglingNodeId={togglingNodeId}
          onRegenerate={() => generateFresh({ force_replan: true })}
        />
      ) : (
        <LegacyRoadmapView
          roadmap={roadmap}
          profile={profile}
          onToggleTask={toggleTask}
          onOpenTaskResource={openTaskResource}
          activeResource={activeResource}
          onCloseResource={() => setActiveResource(null)}
          onResourceStudied={handleResourceStudied}
          completingResource={completingResource}
        />
      )}
    </div>
  );
}
