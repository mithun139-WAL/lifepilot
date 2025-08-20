"use client";

import { useState, useEffect } from "react";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatPromptInput } from "@/components/chat/ChatPromptInput";
import ChatSidebar from "@/components/chat/ChatSidebar";

export default function ChatPage() {
  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [showLoginHint, setShowLoginHint] = useState(false);

  const fetchChatsFromDb = async () => {
    const res = await fetch("/api/chats", { method: "GET" });
    const result = await res.json();
    let loadedChats = result?.data ?? [];
    if (!Array.isArray(loadedChats)) {
      console.warn("Expected chats array, got:", loadedChats);
      loadedChats = [];
    }
    console.log("Fetched chats:", loadedChats);

    setChats(loadedChats);
    if (!activeChatId && loadedChats.length > 0) {
      setActiveChatId(loadedChats[0].id);
    }
  };

  const fetchMessagesForChat = async (chatId: string) => {
    const res = await fetch(`/api/chats/${chatId}/messages`, { method: "GET" });
    const data = await res.json();
    setMessages(data?.data ?? []);
  };

  useEffect(() => {
    fetchChatsFromDb();
  }, []);

  useEffect(() => {
    console.log("second", chats);
  }, [chats]);

  useEffect(() => {
    if (activeChatId) {
      fetchMessagesForChat(activeChatId);
    }
  }, [activeChatId]);

  const fetchUserId = async () => {
    const res = await fetch("/api/auth/session");
    const data = await res.json();
    return data.user.id;
  };

  const handleCreateNewChat = async () => {
    const userId = await fetchUserId();
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Chat", userId }), // <-- send userId
    });
    const chat = await res.json();
    setActiveChatId(chat.id);
    await fetchChatsFromDb();
  };
  const handlePromptSend = async () => {
    setShowLoginHint(true);
    if (activeChatId) {
      await fetchMessagesForChat(activeChatId);
      setShowLoginHint(false);
    } else {
      setShowLoginHint(false);
    }
  };

  const handleAssistantDone = async (chatId: string) => {
    await fetchMessagesForChat(chatId);
    setShowLoginHint(false);
  };

  return (
    <div className="flex h-full">
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        setActiveChatId={setActiveChatId}
        createNewChat={handleCreateNewChat}
      />
      <div className="flex flex-col flex-1">
        <ChatHeader />
        <ChatMessages messages={messages} />
        {showLoginHint && (
          <div className="p-4 text-center text-slate-400">Loading...</div>
        )}
        <ChatPromptInput
          activeChatId={activeChatId}
          createNewChatWithId={setActiveChatId}
          onUserSend={handlePromptSend}
          onAssistantStart={() => {}}
          onAssistantStream={() => {}}
          onChatsLoad={fetchChatsFromDb}
          onAssistantDone={handleAssistantDone}
        />
      </div>
    </div>
  );
}
