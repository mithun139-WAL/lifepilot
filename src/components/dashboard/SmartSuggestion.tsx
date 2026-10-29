"use client";

import { useEffect, useState } from "react";

interface Suggestion {
  text: string;
  emoji: string;
}

import useSWR from "swr";
import { apiClient, authFetcher } from "@/lib/apiClient";
import type { SuggestionsResponse } from "@/types/dashboard";

export function SmartSuggestion() {
  const { data: result, isLoading } = useSWR<SuggestionsResponse>(apiClient.url("/suggestions"), authFetcher, {
    refreshInterval: 300000, // Refresh every 5 mins
  });
  
  const suggestions = (result?.data && result.data.length > 0) ? result.data : [
    { text: "Loading your personalized suggestions...", emoji: "🧠" }
  ];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      if (suggestions.length > 0) {
        setIndex((prev) => (prev + 1) % suggestions.length);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [suggestions.length]);

  useEffect(() => {
    if (suggestions.length > 0) {
      setIndex(Math.floor(Math.random() * suggestions.length));
    } else {
      setIndex(0);
    }
  }, [suggestions]);

  const handleNextSuggestion = () => {
    if (suggestions.length > 0) {
      setIndex((prev) => (prev + 1) % suggestions.length);
    }
  };

  const currentSuggestion = suggestions[index] || suggestions[0];

  return (
    <div className="relative p-3 rounded-xl backdrop-blur-md overflow-hidden group hover:shadow-lg transition-transform duration-300">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 opacity-20 animate-pulse pointer-events-none"></div>
      <div className="absolute inset-0 rounded-xl border border-blue-500 animate-pulse opacity-30 pointer-events-none"></div>
      
      <div className="relative z-10 flex items-center justify-between">
        <p className="text-sm text-blue-200 font-medium transition-opacity duration-500 animate-fadeIn">
          {currentSuggestion?.emoji} {currentSuggestion?.text}
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