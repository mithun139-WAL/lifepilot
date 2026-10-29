"use client";

/**
 * src/app/(app)/journal/page.tsx
 *
 * PURPOSE:
 * The Journal is a first-class daily ritual surface — not a notes dump.
 * It combines two data sources:
 *   1. `/mood` API  — timestamped mood log (server-persisted)
 *   2. localStorage — free-form text notes (client-only, no backend endpoint)
 *
 * WHY LOCALSTORAGE FOR NOTES:
 * The backend has no `/journal` endpoint. Options were:
 *   a) Block the feature until a backend endpoint is built
 *   b) Use localStorage — available immediately, works offline, zero latency
 * We chose (b) because the journal's primary value is the act of writing,
 * not storage or cross-device sync. This is how Day One, Notion, and Bear
 * all started. We surface a subtle "Stored locally" label so users are not
 * misled about persistence.
 *
 * WHY A SPLIT LAYOUT:
 * Left: mood timeline — scrollable history that loads from the API.
 * Provides accountability and pattern recognition ("I'm always stressed
 * on Mondays"). Right: write area — today's note. Single focus, no
 * distraction. This mirrors the physical act of opening a journal and
 * looking back before writing forward.
 *
 * WHY DATES AS SECTION HEADERS:
 * Mood logs grouped by date make patterns immediately visible without
 * any chart overhead. Seeing "Mon Jan 5 — Stressed, Tired, Neutral"
 * is more legible than a line graph with tiny dots.
 *
 * CHARACTER LIMIT (500):
 * Forces conciseness. Long-form journaling belongs in a dedicated notes
 * app. This is a daily check-in, not a diary. The constraint also reduces
 * the cognitive load of "what should I write" — a brief reflection is
 * all that's needed.
 */

import { useEffect, useState, useRef } from "react";
import useSWR from "swr";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { BookOpen, Smile, Save, HardDrive } from "lucide-react";
import { apiClient, authFetcher } from "@/lib/apiClient";

interface MoodEntry {
  mood: string;
  createdAt: string;
}

const MOOD_EMOJI: Record<string, string> = {
  Happy:    "😊",
  Focused:  "🎯",
  Neutral:  "😐",
  Tired:    "😴",
  Stressed: "😵",
};

function moodEmoji(mood: string): string {
  // Direct key match first
  const direct = MOOD_EMOJI[mood.split(" — ")[0]];
  if (direct) return direct;
  // Substring match
  for (const [key, emoji] of Object.entries(MOOD_EMOJI)) {
    if (mood.toLowerCase().includes(key.toLowerCase())) return emoji;
  }
  return "💭";
}

function formatDay(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d))     return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d");
}

/* Group mood entries by calendar date */
function groupByDate(entries: MoodEntry[]): Map<string, MoodEntry[]> {
  const map = new Map<string, MoodEntry[]>();
  for (const e of entries) {
    if (!e.createdAt) continue;          // guard: skip entries with no timestamp
    const day = e.createdAt.split("T")[0];
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(e);
  }
  return map;
}

const STORAGE_KEY = "lifepilot_journal_notes";

export default function JournalPage() {
  const { data: moodResult } = useSWR<any>(apiClient.url("/mood"), authFetcher);

  // FastAPI returns snake_case (`created_at`), but the MoodEntry interface and
  // all downstream helpers (groupByDate, parseISO) expect camelCase (`createdAt`).
  // Normalise here so the rest of the component never has to think about it.
  const rawEntries: any[] = Array.isArray(moodResult)
    ? moodResult
    : moodResult?.data ?? [];

  const moodEntries: MoodEntry[] = rawEntries
    .map((e: any) => ({
      mood: e.mood ?? "",
      createdAt: e.createdAt ?? e.created_at ?? "",
    }))
    .filter((e) => Boolean(e.createdAt)); // drop any entries missing a timestamp

  const grouped = groupByDate(moodEntries);
  const dates   = Array.from(grouped.keys()).sort().reverse();   // newest first

  /* Per-date note storage */
  const todayKey = new Date().toISOString().split("T")[0];
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [activeDate, setActiveDate] = useState<string>(todayKey);
  const [saved, setSaved]   = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Load all notes from localStorage on mount */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setNotes(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const currentNote = notes[activeDate] ?? "";

  const handleChange = (v: string) => {
    if (v.length > 500) return;
    setNotes((prev) => ({ ...prev, [activeDate]: v }));
    setSaved(false);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* quota exceeded — ignore */ }
  };

  /* Auto-save on Cmd/Ctrl+S */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <BookOpen size={16} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Journal</h1>
            <p className="text-xs text-white/35">Daily mood timeline + reflections</p>
          </div>
        </div>
      </div>

      {/* Body — two columns */}
      <div className="flex-1 overflow-hidden flex gap-0 min-h-0">

        {/* ── LEFT: Mood timeline ── */}
        <div className="w-72 flex-shrink-0 border-r border-white/5 overflow-y-auto py-4 px-3 space-y-4">
          <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider px-1">
            Mood Timeline
          </p>

          {dates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 pt-8 text-white/20">
              <Smile size={28} />
              <p className="text-xs text-center">No mood logs yet.<br/>Log your first mood from the dashboard.</p>
            </div>
          ) : (
            dates.map((day) => (
              <div key={day}>
                <button
                  onClick={() => { setActiveDate(day); textareaRef.current?.focus(); }}
                  className={`w-full text-left px-3 py-2 rounded-xl transition-all duration-150 ${
                    activeDate === day
                      ? "bg-violet-500/15 border border-violet-500/25"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <p className={`text-xs font-semibold mb-1.5 ${
                    activeDate === day ? "text-violet-300" : "text-white/50"
                  }`}>
                    {formatDay(day)}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {grouped.get(day)!.map((entry, i) => (
                      <div
                        key={i}
                        title={entry.mood}
                        className="flex items-center gap-1 bg-white/5 border border-white/8 rounded-full px-2 py-0.5"
                      >
                        <span className="text-sm leading-none">{moodEmoji(entry.mood)}</span>
                        <span className="text-[10px] text-white/40 hidden sm:inline">
                          {format(parseISO(entry.createdAt), "h:mm a")}
                        </span>
                      </div>
                    ))}
                  </div>
                </button>
              </div>
            ))
          )}
        </div>

        {/* ── RIGHT: Note editor ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden py-4 px-5">
          {/* Editor header */}
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div>
              <h2 className="text-sm font-semibold text-white">
                {formatDay(activeDate)}
              </h2>
              <div className="flex items-center gap-1 mt-0.5 text-[10px] text-white/25">
                <HardDrive size={9} />
                <span>Stored locally on this device</span>
              </div>
            </div>

            <button
              onClick={handleSave}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                saved
                  ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                  : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20"
              }`}
            >
              <Save size={11} />
              {saved ? "Saved" : "Save"}
            </button>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={currentNote}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={`What's on your mind${activeDate === todayKey ? " today" : " on this day"}?`}
            className="flex-1 w-full bg-white/3 border border-white/8 rounded-xl p-4 text-sm text-white/80 placeholder:text-white/20 resize-none outline-none focus:border-violet-500/40 transition-colors leading-relaxed"
          />

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 flex-shrink-0">
            <p className="text-[10px] text-white/20">
              Tip: ⌘S to save
            </p>
            <p className={`text-[10px] tabular-nums transition-colors ${
              currentNote.length > 450 ? "text-amber-400" : "text-white/25"
            }`}>
              {currentNote.length} / 500
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
