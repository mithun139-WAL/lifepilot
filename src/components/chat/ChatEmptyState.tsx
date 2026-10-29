"use client";

interface Props {
  onPromptSelect: (prompt: string) => void;
}

const SUGGESTED_PROMPTS = [
  {
    icon: "🌅",
    title: "Build a morning routine",
    prompt: "Help me design a productive morning routine that sets me up for success each day.",
  },
  {
    icon: "📊",
    title: "Review my habits",
    prompt: "Let's review my recent habits and see where I'm making progress and where I can improve.",
  },
  {
    icon: "🎯",
    title: "Set a new goal",
    prompt: "I want to set a meaningful goal for this month. Help me define it clearly and create a plan.",
  },
  {
    icon: "🧠",
    title: "Prioritize my week",
    prompt: "I'm feeling overwhelmed with everything on my plate. Help me prioritize what matters most this week.",
  },
];

export default function ChatEmptyState({ onPromptSelect }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-8 animate-fade-in">
      {/* AI icon with glow ring */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-20 h-20 rounded-full bg-violet-500/20 blur-xl" />
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center glow-violet">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
      </div>

      {/* Headline */}
      <div className="text-center space-y-1.5">
        <h2 className="text-xl font-semibold text-white">How can I help you today?</h2>
        <p className="text-sm text-slate-400">
          Your AI life coach — ask anything about habits, goals, or your week.
        </p>
      </div>

      {/* Suggested prompts grid */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
        {SUGGESTED_PROMPTS.map((item) => (
          <button
            key={item.title}
            onClick={() => onPromptSelect(item.prompt)}
            className="text-left p-3.5 surface-1 hover:surface-2 rounded-xl border border-white/[0.08]
                       hover:border-violet-500/30 hover:bg-violet-500/5
                       transition-all duration-200 group cursor-pointer"
          >
            <span className="text-lg block mb-1.5">{item.icon}</span>
            <span className="text-sm text-slate-300 group-hover:text-slate-100 font-medium leading-snug">
              {item.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
