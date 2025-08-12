"use client";

export function JournalPreview() {
  const journal = {
    mood: "🙂",
    text: "Felt relaxed in the morning but distracted after lunch. Need to reduce phone time.",
  };

  return (
    <div className="rounded-2xl p-4 backdrop-blur-md bg-white/5 border border-purple-400/20 shadow-inner text-white h-50">
      <h3 className="text-purple-400 font-semibold mb-3">📖 Journal Preview</h3>
      <p className="text-2xl mb-2">{journal.mood}</p>
      <p className="text-sm text-slate-300">{journal.text}</p>
    </div>
  );
}