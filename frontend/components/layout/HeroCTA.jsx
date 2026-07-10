"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "disha_profile_id";

export default function HeroCTA({ className, startLabel, returningLabel }) {
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    setHasProfile(Boolean(localStorage.getItem(STORAGE_KEY)));
  }, []);

  return (
    <Link href={hasProfile ? "/dashboard" : "/onboarding"} className={className}>
      {hasProfile ? returningLabel : startLabel}
    </Link>
  );
}
