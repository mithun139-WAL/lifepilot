"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatPromptInput } from "@/components/chat/ChatPromptInput";
import ChatSidebar from "@/components/chat/ChatSidebar";
import { useSession } from "next-auth/react";
import PlannerLoader from "@/components/common/PlannerLoader";

export default function ChatPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [showLoginHint, setShowLoginHint] = useState(false);
  const [titleUpdated, setTitleUpdated] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [loaderDots, setLoaderDots] = useState(1);

  const fetchChatsFromDb = useCallback(async (userId: string) => {
    setLoading(true);
    if (!userId) {
      console.error("fetchChatsFromDb: userId is missing");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/chats?userId=${userId}`, { method: "GET" });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch chats: ${res.status} - ${errorText}`);
      }
      const result = await res.json();
      let loadedChats = result?.data ?? [];
      if (!Array.isArray(loadedChats)) {
        console.warn("Expected chats array, got:", loadedChats);
        loadedChats = [];
      }
      const sortedChats = loadedChats.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      setChats(sortedChats);
      if (!activeChatId && sortedChats.length > 0) {
        setActiveChatId(sortedChats[0].id);
      }
    } catch (err: any) {
      console.error("Error fetching chats:", err);
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, [activeChatId]);

  const fetchMessagesForChat = async (chatId: string) => {
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`);
      const data = await res.json();
      setMessages(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      console.error("Error fetching messages:", err);
      setMessages([]);
    }
  };

  useEffect(() => {
    if (!userId) return;
    fetchChatsFromDb(userId as string);
  }, [userId, setTitleUpdated, titleUpdated, fetchChatsFromDb]);

  useEffect(() => {
    console.log("second", chats);
  }, [chats]);

  useEffect(() => {
    if (activeChatId) {
      fetchMessagesForChat(activeChatId);
    }
  }, [activeChatId]);

  const handleCreateNewChat = async () => {
    if (!userId) return;
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat", userId }),
      });
      if (!res.ok) throw new Error(`Failed to create chat: ${res.status}`);
      const chat = await res.json();
      setActiveChatId(chat.id);
      // Refresh chat list
      const resChats = await fetch(`/api/chats?userId=${userId}`);
      const chatsData = await resChats.json();
      setChats(Array.isArray(chatsData?.data) ? chatsData.data : []);
    } catch (err) {
      console.error(err);
    }
  };

  // Loader state for assistant
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
    if (!chatId) return;
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`);
      const data = await res.json();
      setMessages(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      setIsAssistantLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      {loading ? (
        <PlannerLoader />
      ) : (
        <ChatSidebar
          chats={chats}
          activeChatId={activeChatId}
          setActiveChatId={setActiveChatId}
          createNewChat={handleCreateNewChat}
        />
      )}
      <div className="flex flex-col flex-1">
        {/* <ChatHeader /> */}
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
