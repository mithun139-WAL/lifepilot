"use client";
import { useState } from "react";

export function ChatPromptInput({
  onUserSend,
  onAssistantStart,
  onAssistantStream,
  activeChatId,
  createNewChatWithId,
}: {
  onUserSend: (content: string, chatId: string) => void;
  onAssistantStart: (chatId: string) => void;
  onAssistantStream: (chunk: string, chatId: string) => void;
  activeChatId: string | null;
  createNewChatWithId: (id: string) => void;
}) {
  const [input, setInput] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");

    let chatId = activeChatId;

    // ✅ Create new chat and assign new ID
    if (!chatId) {
      chatId = Date.now().toString();
      createNewChatWithId(chatId);

      // ⏱️ Wait one tick to ensure UI reflects the new chat
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    onUserSend(userMessage, chatId);
    onAssistantStart(chatId);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: doneReading } = await reader!.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      onAssistantStream(chunkValue, chatId);
    }
  };

  return (
    <div className="p-4 border-t border-slate-800 bg-slate-900/80 backdrop-blur-md sticky bottom-0">
      <form className="flex gap-2" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything..."
          className="flex-1 p-3 rounded-xl bg-white/10 text-white border border-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-white"
        >
          Send
        </button>
      </form>
    </div>
  );
}