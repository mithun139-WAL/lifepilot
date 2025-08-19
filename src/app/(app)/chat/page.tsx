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

  const createNewChatWithId = (id: string) => {
    const newChat: Chat = { id, title: "New Chat", messages: [] };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(id);
  };

  const addUserMessage = (content: string, chatId: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? { ...chat, messages: [...chat.messages, { role: "user", content }] }
          : chat
      )
    );
  };

  const addAssistantMessage = (chatId: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: [...chat.messages, { role: "assistant", content: "" }],
            }
          : chat
      )
    );
  };

  const appendToAssistant = (chunk: string, chatId: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map((msg, idx) =>
                msg.role === "assistant" && idx === chat.messages.length - 1
                  ? { ...msg, content: msg.content + chunk }
                  : msg
              ),
            }
          : chat
      )
    );
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
        {currentChat?.type !== "planner" && (
          <ChatPromptInput
            activeChatId={activeChatId}
            createNewChatWithId={createNewChatWithId}
            onUserSend={addUserMessage}
            onAssistantStart={addAssistantMessage}
            onAssistantStream={appendToAssistant}
            onChatsLoad={fetchChatsFromDb}
          />
        )}
      </div>
    </div>
  );
}
