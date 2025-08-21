"use client";
import { prisma } from "@/lib/prisma";
import { Send } from "lucide-react";
import { useEffect, useState } from "react";

interface ChatPromptInputProps {
  onUserSend: (content: string, chatId: string) => void;
  onAssistantStart: (chatId: string) => void;
  onAssistantStream: (chunk: string, chatId: string) => void;
  activeChatId: string | null;
  createNewChatWithId: (id: string) => void;
  onAssistantDone?: (chatId: string) => void;
  setAssistantLoading?: (loading: boolean, chatId?: string) => void;
  setTitleUpdated?: (updated: boolean) => void;
}

export function ChatPromptInput({
  onUserSend,
  onAssistantStart,
  onAssistantStream,
  activeChatId,
  createNewChatWithId,
  onAssistantDone,
  setAssistantLoading,
  setTitleUpdated,
}: ChatPromptInputProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loaderDots, setLoaderDots] = useState(0);
  // ChatGPT-style loader animation
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setLoaderDots((dots) => (dots + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, [isLoading]);

  // create new chat
  const createNewChat = async (userMessage: string) => {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: userMessage.slice(0, 30) }),
    });
    return res.json();
  };
  // update chat title
  const updateChatTitle = async (chatId: string, userMessage: string) => {
    const res = await fetch(`/api/chats/${chatId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: userMessage.slice(0, 30) }),
    });
    return res.json();
  };
  // create new message in the chat
  const createNewMessage = async (
    chatId: string,
    role: string,
    userMessage: string
  ) => {
    const res = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        content: userMessage,
      }),
    });
    return res.json();
  };
  const getChatDetails = async (chatId: string) => {
    const res = await fetch(`/api/chats/${chatId}`, { method: "GET" });
    return res.json();
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput("");
    let chatId = activeChatId;
    const chatDetails = await getChatDetails(chatId as string);
    // ✅ Create new chat and assign new ID
    if (!chatDetails) {
      // Create chat in DB and get its ID
      const chatRes = await createNewChat(userMessage);
      chatId = chatRes.id;
      if (chatId) {
        createNewChatWithId(chatId);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    } else if (chatId && chatDetails?.data?.title === "New Chat") {
      const titleUpdated = await updateChatTitle(chatId, userMessage);
      if (titleUpdated) {
        setTitleUpdated?.(true);
      }
    }
    // Save user prompt to DB
    createNewMessage(chatId as string, "user", userMessage);

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

    setIsLoading(true);
    setLoaderDots(0);
    if (setAssistantLoading) setAssistantLoading(true, chatId as string);

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
    await createNewMessage(chatId as string, "assistant", assistantContent);

    setIsLoading(false);
    setLoaderDots(0);
    if (setAssistantLoading) setAssistantLoading(false, chatId as string);

    // Notify parent that assistant message is done
    if (typeof onAssistantDone === "function" && chatId) {
      onAssistantDone(chatId);
    } else if (!chatId) {
      console.error("Chat ID is null. Cannot notify assistant completion.");
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
          className="flex-1 bg-transparent text-white outline-none placeholder:text-slate-400 border border-blue-500/30 rounded-xl px-4 py-3 backdrop-blur-md shadow-[0_0_20px_#3B82F6]/30 flex items-center gap-3"
          disabled={isLoading}
        />
        <button
          type="submit"
          className="px-4 rounded-full bg-blue-500 hover:bg-blue-900 transition cursor-pointer"
          disabled={isLoading}
        >
          <Send size={16} className="text-white" />
        </button>
        {isLoading && (
          <div className="flex items-center ml-2 text-slate-400 font-mono text-lg min-w-[32px]">
            {Array(loaderDots).fill(".").join("")}
            <span className="sr-only">AI is typing</span>
          </div>
        )}
      </form>
    </div>
  );
}
