"use client";

import { useState, useEffect } from "react";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatPromptInput } from "@/components/chat/ChatPromptInput";
import ChatSidebar from "@/components/chat/ChatSidebar";
import { useSession } from "next-auth/react";
export default function ChatPage() {
  const { data: session } = useSession();
  const userId= session?.user?.id;
  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [showLoginHint, setShowLoginHint] = useState(false);
  const [titleUpdated, setTitleUpdated] = useState<boolean>(false);

  const fetchChatsFromDb = async (userId: string) => {
    const res = await fetch(`/api/chats?userId=${userId}`, { method: "GET" });
    const result = await res.json();
    let loadedChats = result?.data ?? [];
    if (!Array.isArray(loadedChats)) {
      console.warn("Expected chats array, got:", loadedChats);
      loadedChats = [];
    }
    console.log("Fetched chats:", loadedChats);
    const sortedChats = loadedChats.sort((a, b) => a.createdAt - b.createdAt);
    setChats(sortedChats);
    if (!activeChatId && sortedChats.length > 0) {
      setActiveChatId(loadedChats[0].id);
    }
  };

  const fetchMessagesForChat = async (chatId: string) => {
    const res = await fetch(`/api/chats/${chatId}/messages`, { method: "GET" });
    const data = await res.json();
    setMessages(data?.data ?? []);
  };

  useEffect(() => {
    fetchChatsFromDb(userId as string);
  }, [setTitleUpdated, titleUpdated]);

  useEffect(() => {
    console.log("second", chats);
  }, [chats]);

  useEffect(() => {
    if (activeChatId) {
      fetchMessagesForChat(activeChatId);
    }
  }, [activeChatId]);

  // const fetchUserId = async () => {
  //   const res = await fetch("/api/auth/session");
  //   const data = await res.json();
  //   return data.user.id;
  // };

  const handleCreateNewChat = async () => {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Chat", userId }), // <-- send userId
    });
    const chat = await res.json();
    setActiveChatId(chat.id);
    await fetchChatsFromDb(userId as string);
  };

  // Loader state for assistant
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [loaderDots, setLoaderDots] = useState(1);
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isAssistantLoading) {
      interval = setInterval(() => {
        setLoaderDots((dots) => (dots + 1) % 4 || 1);
      }, 500);
    } else {
      setLoaderDots(1);
    }
    return () => interval && clearInterval(interval);
  }, [isAssistantLoading]);

  const handlePromptSend = async (userMessage: string) => {
    // Add user message immediately
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsAssistantLoading(true);
    setShowLoginHint(false);
  };

  const handleAssistantDone = async (chatId: string) => {
    // Fetch messages from DB (should include the real AI response)
    await fetchMessagesForChat(chatId);
    setIsAssistantLoading(false);
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
        {isAssistantLoading && (
          <div className="p-4 text-center text-slate-400 font-mono text-lg">
            {Array(loaderDots).fill(".").join("")}
          </div>
        )}
        <ChatPromptInput
          activeChatId={activeChatId}
          createNewChatWithId={setActiveChatId}
          onUserSend={handlePromptSend}
          onAssistantStart={() => {}}
          onAssistantStream={() => {}}
          onChatsLoad={fetchChatsFromDb}
          onAssistantDone={handleAssistantDone}
          setTitleUpdated={setTitleUpdated}
          messages={messages}
        />
      </div>
    </div>
  );
}
