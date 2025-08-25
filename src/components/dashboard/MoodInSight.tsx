"use client";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

const moods = [
  { label: "Happy", emoji: "😊" },
  { label: "Neutral", emoji: "😐" },
  { label: "Sad", emoji: "😔" },
  { label: "Stressed", emoji: "😵" },
  { label: "Sleepy", emoji: "😴" },
];

export function MoodInsight() {
  const [moodLogs, setMoodLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mood")
      .then((res) => res.json())
      .then((data) => {
        // assume API returns an array of moods [{mood, createdAt}]
        setMoodLogs(data || []);
        setLoading(false);
      });
  }, []);

  const logMood = async (mood: string) => {
    const res = await fetch("/api/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood }),
    });
    const data = await res.json();

    setMoodLogs((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      return [data, ...safePrev];
    });
  };

  return (
    <div className="backdrop-blur-md rounded-xl border border-blue-500/20 p-4 shadow-inner h-60 flex flex-col">
      <h3 className="text-blue-500 font-semibold mb-4">Mood Insights</h3>

      {/* Logs Section */}
      <div className="flex-1 overflow-y-auto mb-4 pr-1">
        {loading ? (
          <p className="text-slate-400">Loading...</p>
        ) : moodLogs.length > 0 ? (
          <ul className="space-y-2 text-sm text-slate-300">
            {moodLogs.map((log, i) => (
              <li key={i} className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <span className="text-md">
                    {moods.find((m) => m.label === log.mood)?.emoji || "😊"} You
                    logged your mood as{" "}
                    <span className="text-cyan-400">
                      {log.mood}
                    </span>{" "}
                    {log.createdAt
                      ? formatDistanceToNow(new Date(log.createdAt), {
                          addSuffix: true,
                        })
                      : ""}
                    .
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400">No moods logged yet.</p>
        )}
      </div>

      {/* Logger Buttons */}
      <div className="flex gap-2 overflow-x-auto flex-nowrap w-full">
        {moods.map((m) => (
          <button
            key={m.label}
            onClick={() => logMood(m.label)}
            className="px-2 py-0 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-1 flex-shrink-0"
          >
            <span className="text-lg">{m.emoji}</span> {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
