"use client";
import { Send } from "lucide-react";
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
      if (chatId) {
        createNewChatWithId(chatId);
      }

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

    if (chatId) {
      onUserSend(userMessage, chatId);
    } else {
      console.error("Chat ID is null. Cannot send user message.");
    }
    if (chatId) {
      onAssistantStart(chatId);
    } else {
      console.error("Chat ID is null. Cannot start assistant.");
    }

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
      if (chatId) {
        onAssistantStream(chunkValue, chatId);
      } else {
        console.error("Chat ID is null. Cannot stream assistant response.");
      }
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
    if (typeof onAssistantDone === "function" && chatId) {
      onAssistantDone(chatId);
    } else if (!chatId) {
      console.error("Chat ID is null. Cannot notify assistant completion.");
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
          className="flex-1 bg-transparent text-white outline-none placeholder:text-slate-400 border border-blue-500/30 rounded-xl px-4 py-3 backdrop-blur-md shadow-[0_0_20px_#3B82F6]/30 flex items-center gap-3"
        />
        <button
          type="submit"
          className="px-4 rounded-full bg-blue-500 hover:bg-blue-900 transition cursor-pointer"
        >
          <Send size={16} className="text-white" />
        </button>
      </form>
    </div>
  );
}