"use client";

/**
 * src/app/(app)/profile/page.tsx
 *
 * User profile page — three sections:
 *
 * 1. IDENTITY  — name and avatar URL, editable
 * 2. PREFERENCES — the same six fields collected at onboarding
 *    (skillLevel, weeklyHours, pace, deadline, preferredFormats)
 *    displayed with the same controls and editable at any time.
 *    Saving calls PUT /auth/profile → refreshUser() re-hydrates AuthContext.
 *
 * 3. AI GOAL SUGGESTIONS — on page load (and after saving preferences)
 *    calls POST /goals/suggest which uses the fast 8B LLM to generate 4
 *    personalised goal ideas based on the updated profile.
 *    Clicking a card:
 *      a. POST /goals   → creates the goal
 *      b. POST /planner → generates the learning plan (shows progress modal)
 *      c. router.push("/dashboard")
 */

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import {
  Pencil,
  Save,
  Sparkles,
  RefreshCw,
  Loader2,
  BookOpen,
  Clock,
  Zap,
  Calendar,
  Monitor,
  CheckCircle2,
  ArrowRight,
  Target,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiClient, authFetcher } from "@/lib/apiClient";
import { startPlannerJob } from "@/lib/plannerJob";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GoalItem {
  id: string;
  title: string;
  hours_per_day: string;
  target_weeks: number;
  created_at: string;
}

interface GoalListResponse {
  data: GoalItem[];
}

interface GoalSuggestion {
  title: string;
  description: string;
  emoji: string;
  suggestedWeeks: number;
  hoursPerDay: string;
}

type SkillLevel    = "beginner" | "intermediate" | "advanced";
type Pace          = "slow" | "steady" | "fast";
type FormatOption  = "video" | "text" | "projects" | "interactive";

// ── Constants ─────────────────────────────────────────────────────────────────

const SKILL_OPTIONS: { value: SkillLevel; label: string; desc: string; icon: string }[] = [
  { value: "beginner",     label: "Beginner",     desc: "Just getting started",        icon: "🌱" },
  { value: "intermediate", label: "Intermediate", desc: "Some experience",              icon: "🌿" },
  { value: "advanced",     label: "Advanced",     desc: "Solid foundation, going deep", icon: "🌳" },
];

const PACE_OPTIONS: { value: Pace; label: string; desc: string; icon: string }[] = [
  { value: "slow",   label: "Relaxed", desc: "Take my time, less pressure",     icon: "🐢" },
  { value: "steady", label: "Steady",  desc: "Balanced progress, stay on track", icon: "🚶" },
  { value: "fast",   label: "Sprint",  desc: "Intensive, results quickly",       icon: "🚀" },
];

const FORMAT_OPTIONS: { value: FormatOption; label: string; icon: string }[] = [
  { value: "video",       label: "Video",       icon: "🎬" },
  { value: "text",        label: "Reading",     icon: "📚" },
  { value: "projects",    label: "Projects",    icon: "🛠️" },
  { value: "interactive", label: "Interactive", icon: "🧩" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert weeklyHours (integer) to the hoursPerDay string the goals API expects */
function weeklyToHoursPerDay(weekly: number): string {
  const raw = Math.max(1, Math.round(weekly / 5));
  return `${raw} hour${raw !== 1 ? "s" : ""}`;
}

/** Convert pace to targetWeeks integer */
function paceToWeeks(pace: Pace): number {
  return { slow: 12, steady: 8, fast: 4 }[pace];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GoalRow({ goal }: { goal: GoalItem }) {
  const createdDate = new Date(goal.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <Link
      href="/planner"
      className="group flex items-center gap-4 px-4 py-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] hover:border-violet-500/30 transition-all duration-150"
    >
      <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
        <Target size={15} className="text-violet-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate leading-snug">
          {goal.title}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {goal.hours_per_day}/day · {goal.target_weeks} weeks · started {createdDate}
        </p>
      </div>
      <ChevronRight
        size={14}
        className="text-slate-600 group-hover:text-violet-400 transition-colors shrink-0"
      />
    </Link>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-1 rounded-2xl p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 min-w-0 flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-xs font-medium transition-all duration-150 cursor-pointer",
        selected
          ? "bg-violet-500/20 border-violet-400/60 text-violet-300"
          : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200 hover:border-white/[0.14]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function FormatChip({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer",
        selected
          ? "bg-violet-500/20 border-violet-400/50 text-violet-300"
          : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-slate-200",
      ].join(" ")}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

function SuggestionCard({
  suggestion,
  onSelect,
  loading,
}: {
  suggestion: GoalSuggestion;
  onSelect: () => void;
  loading: boolean;
}) {
  return (
    <div className="surface-1 rounded-2xl p-5 flex flex-col gap-3 hover:border-violet-500/30 border border-white/[0.06] transition-all duration-200 group">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{suggestion.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-snug">{suggestion.title}</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{suggestion.description}</p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {suggestion.hoursPerDay}/day
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={10} />
          {suggestion.suggestedWeeks} weeks
        </span>
      </div>

      <button
        onClick={onSelect}
        disabled={loading}
        className={[
          "w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all",
          loading
            ? "bg-violet-500/20 text-violet-400 cursor-not-allowed"
            : "bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 hover:text-violet-200 cursor-pointer",
        ].join(" ")}
      >
        {loading ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            Generating plan…
          </>
        ) : (
          <>
            Start Learning
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </>
        )}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const { user, refreshUser, isAuthenticated } = useAuth();

  // ── Fetch existing goals ──────────────────────────────────────────────────
  const { data: goalsData, isLoading: goalsLoading } = useSWR<GoalListResponse>(
    isAuthenticated ? apiClient.url("/goals") : null,
    authFetcher,
  );
  const existingGoals: GoalItem[] = goalsData?.data ?? [];

  // ── Form state — seeded from AuthContext on mount ─────────────────────────
  const [name,             setName]             = useState("");
  const [imageUrl,         setImageUrl]         = useState("");
  const [skillLevel,       setSkillLevel]       = useState<SkillLevel>("beginner");
  const [weeklyHours,      setWeeklyHours]      = useState(5);
  const [pace,             setPace]             = useState<Pace>("steady");
  const [deadline,         setDeadline]         = useState("");
  const [preferredFormats, setPreferredFormats] = useState<FormatOption[]>([]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [saving,           setSaving]           = useState(false);
  const [saveSuccess,      setSaveSuccess]      = useState(false);
  const [saveError,        setSaveError]        = useState<string | null>(null);
  const [suggestions,      setSuggestions]      = useState<GoalSuggestion[]>([]);
  const [suggestLoading,   setSuggestLoading]   = useState(false);
  const [creatingGoalIdx,  setCreatingGoalIdx]  = useState<number | null>(null);

  // ── Seed form from user context on mount ──────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setImageUrl(user.image ?? "");
    setSkillLevel((user.skillLevel as SkillLevel) ?? "beginner");
    setWeeklyHours(user.weeklyHours ?? 5);
    setPace((user.pace as Pace) ?? "steady");
    setDeadline(
      user.deadline ? user.deadline.slice(0, 10) : ""
    );
    setPreferredFormats(
      Array.isArray(user.preferredFormats)
        ? (user.preferredFormats as FormatOption[])
        : []
    );
  }, [user]);

  // ── Fetch suggestions on mount (and after saving) ─────────────────────────
  const fetchSuggestions = useCallback(async () => {
    if (!isAuthenticated) return;
    setSuggestLoading(true);
    try {
      const res = await apiClient.post<{ suggestions: GoalSuggestion[] }>("/goals/suggest");
      setSuggestions(res.suggestions ?? []);
    } catch (err) {
      console.error("[Profile] suggestion fetch failed:", err);
    } finally {
      setSuggestLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // ── Toggle a format chip ──────────────────────────────────────────────────
  const toggleFormat = (fmt: FormatOption) => {
    setPreferredFormats((prev) =>
      prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt]
    );
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await apiClient.put("/auth/profile", {
        name:             name.trim() || undefined,
        image:            imageUrl.trim() || undefined,
        skillLevel:       skillLevel,
        weeklyHours:      weeklyHours,
        pace:             pace,
        deadline:         deadline || undefined,
        preferredFormats: preferredFormats.length > 0 ? preferredFormats : undefined,
      });
      await refreshUser();          // re-hydrate AuthContext
      await fetchSuggestions();     // refresh suggestions with new preferences
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setSaveError((err as { message?: string })?.message ?? "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  // ── Create goal + generate plan from a suggestion ─────────────────────────
  const handleSelectSuggestion = async (idx: number, suggestion: GoalSuggestion) => {
    setCreatingGoalIdx(idx);
    try {
      // 1. Create the goal
      const goalRes = await apiClient.post<{ data: { id: string } }>("/goals", {
        title:       suggestion.title,
        hoursPerDay: suggestion.hoursPerDay,
        targetWeeks: suggestion.suggestedWeeks,
      });
      const goalId = goalRes.data?.id;
      if (!goalId) throw new Error("Goal creation returned no ID");

      // 2. Generate the learning plan (the slow 4-stage AI pipeline)
      await startPlannerJob(goalId);

      // 3. Navigate to dashboard
      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("[Profile] goal creation failed:", err);
      alert((err as { message?: string })?.message ?? "Failed to create goal. Please try again.");
    } finally {
      setCreatingGoalIdx(null);
    }
  };

  // ── Avatar placeholder ────────────────────────────────────────────────────
  const initials = (name || user?.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 animate-fade-in">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white">Profile</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Your identity, learning preferences, and AI-curated goal ideas
        </p>
      </div>

      {/* ── Section 1: Identity ───────────────────────────────────────────── */}
      <SectionCard title="Identity" subtitle="Your name and avatar displayed across the app">
        <div className="flex items-center gap-5">
          {/* Avatar preview */}
          <div className="relative shrink-0">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={name || "Avatar"}
                width={64}
                height={64}
                className="w-16 h-16 rounded-full object-cover border-2 border-violet-500/30"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-violet-500/20 border-2 border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-lg select-none">
                {initials}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
              <Pencil size={10} className="text-slate-400" />
            </div>
          </div>

          {/* Fields */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1.5">
                Display name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1.5">
                Email
              </label>
              <input
                value={user?.email ?? ""}
                disabled
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1.5">
                Avatar URL <span className="normal-case text-slate-600">(optional)</span>
              </label>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Section 2: Your Goals ─────────────────────────────────────── */}
      <SectionCard
        title="Your Goals"
        subtitle="Goals you're actively working on — click to open your planner"
      >
        {goalsLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : existingGoals.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Target size={28} className="text-slate-700" />
            <p className="text-sm text-slate-500">No goals yet.</p>
            <p className="text-xs text-slate-600">
              Pick a suggestion below to create your first goal.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {existingGoals.map((g) => (
              <GoalRow key={g.id} goal={g} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Section 3: Preferences ────────────────────────────────────────── */}
      <SectionCard
        title="Learning Preferences"
        subtitle="Updating these will refresh your AI goal suggestions below"
      >
        {/* Skill level */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
            <BookOpen size={10} /> Skill level
          </label>
          <div className="flex gap-2">
            {SKILL_OPTIONS.map((opt) => (
              <OptionButton
                key={opt.value}
                selected={skillLevel === opt.value}
                onClick={() => setSkillLevel(opt.value)}
              >
                <span className="text-base">{opt.icon}</span>
                <span>{opt.label}</span>
                <span className="text-[9px] text-slate-500 text-center leading-tight">{opt.desc}</span>
              </OptionButton>
            ))}
          </div>
        </div>

        {/* Weekly hours */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
            <Clock size={10} />
            Weekly hours available
            <span className="ml-auto text-violet-300 font-semibold text-xs tabular-nums">
              {weeklyHours}h / week
            </span>
          </label>
          <input
            type="range"
            min={1}
            max={40}
            value={weeklyHours}
            onChange={(e) => setWeeklyHours(Number(e.target.value))}
            className="w-full accent-violet-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>1h</span>
            <span>20h</span>
            <span>40h</span>
          </div>
        </div>

        {/* Pace */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
            <Zap size={10} /> Learning pace
          </label>
          <div className="flex gap-2">
            {PACE_OPTIONS.map((opt) => (
              <OptionButton
                key={opt.value}
                selected={pace === opt.value}
                onClick={() => setPace(opt.value)}
              >
                <span className="text-base">{opt.icon}</span>
                <span>{opt.label}</span>
                <span className="text-[9px] text-slate-500 text-center leading-tight">{opt.desc}</span>
              </OptionButton>
            ))}
          </div>
        </div>

        {/* Deadline */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
            <Calendar size={10} /> Target deadline
            <span className="normal-case text-slate-600 text-[10px]">(optional)</span>
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="bg-white/[0.05] border border-white/[0.10] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50 transition-colors [color-scheme:dark]"
          />
        </div>

        {/* Preferred formats */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
            <Monitor size={10} /> Preferred formats
          </label>
          <div className="flex flex-wrap gap-2">
            {FORMAT_OPTIONS.map((opt) => (
              <FormatChip
                key={opt.value}
                label={opt.label}
                icon={opt.icon}
                selected={preferredFormats.includes(opt.value)}
                onClick={() => toggleFormat(opt.value)}
              />
            ))}
          </div>
        </div>

        {/* Save button + feedback */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className={[
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
              saving
                ? "bg-violet-500/20 text-violet-400 cursor-not-allowed"
                : "bg-violet-600 hover:bg-violet-500 text-white cursor-pointer shadow-lg shadow-violet-900/30",
            ].join(" ")}
          >
            {saving ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save size={15} />
                Save Preferences
              </>
            )}
          </button>

          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 size={13} />
              Saved — suggestions refreshed
            </span>
          )}
          {saveError && (
            <span className="text-xs text-rose-400">{saveError}</span>
          )}
        </div>
      </SectionCard>

      {/* ── Section 4: AI goal suggestions ───────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles size={15} className="text-violet-400" />
              Suggested Goals for You
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              AI-personalised based on your skill level, pace, and time
            </p>
          </div>
          <button
            onClick={fetchSuggestions}
            disabled={suggestLoading}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-violet-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <RefreshCw size={12} className={suggestLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {suggestLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="surface-1 rounded-2xl p-5 h-40 animate-pulse border border-white/[0.06]"
              />
            ))}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="surface-1 rounded-2xl p-8 text-center text-slate-500 text-sm border border-white/[0.06]">
            No suggestions available — try saving your preferences.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {suggestions.map((s, idx) => (
              <SuggestionCard
                key={idx}
                suggestion={s}
                loading={creatingGoalIdx === idx}
                onSelect={() => handleSelectSuggestion(idx, s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
