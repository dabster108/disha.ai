"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudentProfileExtended } from "@/types/profile";
import { Camera, Download, Share2, Pencil, MapPin, GraduationCap, Target } from "lucide-react";

type ProfileHeroProps = {
  profile: StudentProfileExtended;
  onEdit: () => void;
};

export function ProfileHero({ profile, onEdit }: ProfileHeroProps) {
  const initials = profile.personal.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest"
    >
      <div className="relative h-36 bg-surface-container-high md:h-44">
        {profile.coverImage ? (
          <Image src={profile.coverImage} alt="" fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-surface-container" />
        )}
      </div>

      <div className="relative px-6 pb-6 md:px-8 md:pb-8">
        <div className="-mt-12 mb-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex items-end gap-5">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-4 border-surface-container-lowest bg-primary text-2xl font-bold text-on-primary shadow-sm">
              {profile.avatarUrl ? (
                <Image src={profile.avatarUrl} alt={profile.personal.fullName} fill className="rounded-xl object-cover" />
              ) : (
                initials
              )}
              <button
                type="button"
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-secondary hover:text-on-surface"
                aria-label="Change photo"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <div className="min-w-0 pb-1">
              <h1 className="truncate text-display-lg-mobile font-semibold text-on-surface md:text-headline-lg">
                {profile.personal.fullName}
              </h1>
              <p className="text-body-md text-secondary">@{profile.personal.username}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-secondary">
                <span className="inline-flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" />
                  {profile.currentRole}
                </span>
                <span className="inline-flex items-center gap-1">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {profile.university}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {profile.personal.city}, {profile.personal.country}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Edit Profile
            </Button>
            <Button variant="secondary" size="sm">
              <Download className="h-4 w-4" />
              Download Resume
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="default">Career Goal: {profile.careerGoal.dreamJob}</Badge>
        </div>
      </div>
    </motion.div>
  );
}
