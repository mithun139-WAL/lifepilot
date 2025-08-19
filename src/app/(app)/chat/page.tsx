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
  const [messages, setMessages] = useState<any[]>([]);
  const [showLoginHint, setShowLoginHint] = useState(false);

  // Always fetch chats from DB
  const fetchChatsFromDb = async () => {
    const res = await fetch("/api/chats", { method: "GET" });
    const loadedChats = await res.json();
    setChats(loadedChats);
    if (!activeChatId && loadedChats.length > 0) {
      setActiveChatId(loadedChats[0].id);
    }
  };

  // Fetch messages for the active chat
  const fetchMessagesForChat = async (chatId: string) => {
    const res = await fetch(`/api/chats/${chatId}/messages`, { method: "GET" });
    const msgs = await res.json();
    setMessages(msgs);
  };

  useEffect(() => {
    fetchChatsFromDb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log('second', chats);
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

  async function fetchPlanner() {
    const plannerChatId = "planner-chat";
  
    setChats((prev) => {
      if (prev.find((c) => c.id === plannerChatId)) return prev;
  
      const newChat: Chat = {
        id: plannerChatId,
        title: "Learning Plan",
        messages: [{ role: "assistant", content: "" }],
        type: "planner",
      };
  
      setActiveChatId(plannerChatId);
      return [newChat, ...prev];
    });
  
    try {
      console.log("➡️ Triggering fetchPlanner...");
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "Lose fat and weight and gain muscle and provide deit for 1 months which should be recursive and followed the same every month", duration: "1 month" }),
      });
      console.log("Raw planner response:", res.status, res.ok);

      const raw = await res.text(); 
      const jsonStart = raw.indexOf("{");
      const jsonEnd = raw.lastIndexOf("}") + 1;
      let content = raw;
      
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonString = raw.slice(jsonStart, jsonEnd);
        try {
          const parsed = JSON.parse(jsonString);
          content = JSON.stringify(parsed, null, 2);
        } catch (err) {
          console.error("Failed to parse planner JSON:", err);
          content = raw;
        }
      }
      
      setChats((prev) =>
        prev.map((c) =>
          c.id === plannerChatId
            ? {
                ...c,
                messages: c.messages.map((msg, idx) =>
                  msg.role === "assistant" && idx === c.messages.length - 1
                    ? { ...msg, content }
                    : msg
                ),
              }
            : c
        )
      );
    } catch (err) {
      console.error("Failed to fetch planner:", err);
    }
  }
  

  useEffect(() => {
    fetchPlanner();
  }, []);
  // Show login hint while waiting for assistant
  const handlePromptSend = async () => {
    setShowLoginHint(true);
    if (activeChatId) {
      await fetchMessagesForChat(activeChatId);
      setShowLoginHint(false);
    } else {
      setShowLoginHint(false);
    }
  };

  // Add this callback to update messages after assistant response
  const handleAssistantDone = async (chatId: string) => {
    await fetchMessagesForChat(chatId);
    setShowLoginHint(false);
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
        <ChatMessages messages={messages} />
         {showLoginHint && (
          <div className="p-4 text-center text-slate-400">Loading...</div>
        )}
        {currentChat?.type !== "planner" && (
          <ChatPromptInput
            activeChatId={activeChatId}
            createNewChatWithId={setActiveChatId}
            onUserSend={handlePromptSend}
            onAssistantStart={() => {}}
            onAssistantStream={() => {}}
            onChatsLoad={fetchChatsFromDb}
            onAssistantDone={handleAssistantDone}
          />
        )}
      </div>
    </div>
  );
}
