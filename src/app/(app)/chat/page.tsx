"use client";

import { useState, useEffect } from "react";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatPromptInput } from "@/components/chat/ChatPromptInput";
import ChatSidebar from "@/components/chat/ChatSidebar";
import { Chat } from "@/types/chat";

export default function ChatPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Always fetch chats from DB
  const fetchChatsFromDb = async () => {
    const res = await fetch("/api/chats", { method: "GET" });
    const loadedChats = await res.json();
    setChats(loadedChats);
    if (!activeChatId && loadedChats.length > 0) {
      setActiveChatId(loadedChats[0].id);
    }
  };

  useEffect(() => {
    fetchChatsFromDb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log('second', chats);
  }, [chats]);

  const handleCreateNewChat = async () => {
    // Create a new chat in DB via POST API
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Chat" }),
    });
    const chat = await res.json();
    setActiveChatId(chat.id);
    await fetchChatsFromDb();
  };

  const currentChat = chats.find((c) => c.id === activeChatId);

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
        <ChatMessages messages={currentChat?.messages || []} />
        <ChatPromptInput
          activeChatId={activeChatId}
          createNewChatWithId={setActiveChatId}
          onUserSend={() => {}}
          onAssistantStart={() => {}}
          onAssistantStream={() => {}}
          onChatsLoad={fetchChatsFromDb}
        />
      </div>
    </div>
  );
}