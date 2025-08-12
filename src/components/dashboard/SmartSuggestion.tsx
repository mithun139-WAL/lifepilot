"use client";

import { useEffect, useState } from "react";

const suggestions = [
  "You’ve been sitting for 3 hours — how about a 10-minute walk?",
  "Your mood has been low lately. Try journaling today.",
  "No meetings for 2 hours — maybe deep focus time?",
  "Hydrate! It’s been 3 hours since your last water intake.",
  "You completed 5 habits this week — nice work!",
];

export function SmartSuggestion() {
  const [text, setText] = useState("");

  useEffect(() => {
    const random = suggestions[Math.floor(Math.random() * suggestions.length)];
    setText(random);
  }, []);

  return (
    <div className="relative p-2 rounded-xl backdrop-blur-md overflow-hidden">
      <div className="absolute inset-0 rounded-xl border border-blue-500 animate-pulse opacity-30"></div>
      <p className="text-sm text-blue-200 font-medium relative z-10">
        🔮 {text}
      </p>
    </div>
  );
}
