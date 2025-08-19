"use client";
import { useState } from "react";

export function ChatPromptInput({
  onUserSend,
  onAssistantStart,
  onAssistantStream,
  activeChatId,
  createNewChatWithId,
  onAssistantDone, // <-- Add this prop
}: {
  onUserSend: (content: string, chatId: string) => void;
  onAssistantStart: (chatId: string) => void;
  onAssistantStream: (chunk: string, chatId: string) => void;
  activeChatId: string | null;
  createNewChatWithId: (id: string) => void;
  onAssistantDone?: (chatId: string) => void; // <-- Add this prop type
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
      // Create chat in DB and get its ID
      const chatRes = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: userMessage.slice(0, 30) }),
      });
      const chatData = await chatRes.json();
      chatId = chatData.id;
      createNewChatWithId(chatId);

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Save user prompt to DB
    await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "user",
        content: userMessage,
      }),
    });

    onUserSend(userMessage, chatId);
    onAssistantStart(chatId);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let done = false;

    let assistantContent = "";

    while (!done) {
      const { value, done: doneReading } = await reader!.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      assistantContent += chunkValue;
      onAssistantStream(chunkValue, chatId);
    }

    // Save LLM response to DB (use the same API route as user message)
    await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "assistant",
        content: assistantContent,
      }),
    });

    // Notify parent that assistant message is done
    if (typeof onAssistantDone === "function") {
      onAssistantDone(chatId);
    }

    // Refetch chats/messages from DB to update FE
    // If you have an onChatsLoad or similar, call it here
    // Example:
    // if (typeof onChatsLoad === "function") {
    //   const chatsRes = await fetch("/api/chats", { method: "GET" });
    //   const chats = await chatsRes.json();
    //   onChatsLoad(chats);
    // }
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