"use client";

import { useState } from "react";
import { Send } from "lucide-react";

export default function PromptBox() {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    console.log("Submit prompt:", prompt);
    setPrompt("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-blue-500/30 rounded-xl px-4 py-3 backdrop-blur-md shadow-[0_0_20px_#3B82F6]/30 flex items-center gap-3"
    >
      <input
        type="text"
        placeholder="Talk to LifePilot..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="bg-transparent text-white flex-1 outline-none placeholder:text-slate-400"
      />
      <button
        type="submit"
        className="p-2 rounded-full bg-blue-500 hover:bg-blue-900 transition cursor-pointer"
      >
        <Send size={16} className="text-white" />
      </button>
    </form>
  );
}