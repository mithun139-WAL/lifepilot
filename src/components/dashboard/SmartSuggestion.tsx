"use client";

import { useEffect, useState } from "react";

interface Suggestion {
  text: string;
  emoji: string;
}

const suggestions: Suggestion[] = [
  { text: "You’ve been sitting for 3 hours — how about a 10-minute walk?", emoji: "🏃" },
  { text: "Your mood has been low lately. Try journaling today.", emoji: "✍️" },
  { text: "No meetings for 2 hours — maybe deep focus time?", emoji: "🧘" },
  { text: "Hydrate! It’s been 3 hours since your last water intake.", emoji: "💧" },
  { text: "You completed 5 habits this week — nice work!", emoji: "🎉" },
];

export function SmartSuggestion() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % suggestions.length);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setIndex(Math.floor(Math.random() * suggestions.length));
  }, []);

  const handleNextSuggestion = () => {
    setIndex((prev) => (prev + 1) % suggestions.length);
  };

  return (
    <div className="relative p-3 rounded-xl backdrop-blur-md overflow-hidden group hover:shadow-lg transition-transform duration-300">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 opacity-20 animate-pulse pointer-events-none"></div>
      <div className="absolute inset-0 rounded-xl border border-blue-500 animate-pulse opacity-30 pointer-events-none"></div>
      
      <div className="relative z-10 flex items-center justify-between">
        <p className="text-sm text-blue-200 font-medium transition-opacity duration-500 animate-fadeIn">
          {suggestions[index].emoji} {suggestions[index].text}
        </p>
        <button
          onClick={handleNextSuggestion}
          className="ml-2 text-blue-400 hover:text-blue-200 text-xs transition-colors"
        >
          🔄
        </button>
      </div>
    </div>
  );
}