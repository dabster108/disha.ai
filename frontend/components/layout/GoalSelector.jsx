"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import CareerRoleInput from "@/components/ui/CareerRoleInput";
import { useProfile } from "@/context/ProfileContext";

export default function GoalSelector() {
  const { goals, activeGoal, switchGoal, addGoal } = useProfile();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [switching, setSwitching] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!activeGoal && goals.length === 0) return null;

  const handleSwitch = async (goal) => {
    if (goal === activeGoal) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await switchGoal(goal);
    } finally {
      setSwitching(false);
      setOpen(false);
    }
  };

  const handleAdd = async (role) => {
    setSwitching(true);
    try {
      await addGoal(role);
      setAdding(false);
      setOpen(false);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className="flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-low px-4 py-2 text-label-md font-bold text-primary transition-colors hover:bg-surface-container-high disabled:opacity-60"
      >
        <span>Goal: {activeGoal}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-lg">
          <div className="border-b border-outline-variant px-3 py-2">
            <p className="text-label-sm font-semibold text-secondary">Your career goals</p>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {goals.map((goal) => (
              <li key={goal}>
                <button
                  type="button"
                  onClick={() => handleSwitch(goal)}
                  className={`flex w-full items-center px-4 py-2.5 text-left text-label-md transition-colors hover:bg-surface-container-low ${
                    goal === activeGoal ? "font-bold text-primary" : "text-on-surface"
                  }`}
                >
                  {goal}
                  {goal === activeGoal && (
                    <span className="ml-auto text-xs text-primary">Active</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-outline-variant p-2">
            {adding ? (
              <CareerRoleInput
                exclude={goals}
                onSelect={handleAdd}
                onCancel={() => setAdding(false)}
                placeholder="e.g. Backend Developer"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-label-md text-secondary transition-colors hover:bg-surface-container-low hover:text-primary"
              >
                <Plus className="h-4 w-4" />
                Add new goal
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
