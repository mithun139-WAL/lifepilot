"use client";

import { Chat, ChatMessage } from "@/types/chat";
import { createContext, useContext, useState, ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";

type ChatContextType = {
  chats: Chat[];
  activeChatId: string | null;
  createNewChat: () => void;
  setActiveChatId: (id: string) => void;
  addMessageToChat: (message: ChatMessage) => void;
  updateLastMessageInChat: (id: string, content: string) => void;
};

// Create context
const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Hook
export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within ChatProvider");
  return context;
};

// Provider
export function ChatProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const createNewChat = () => {
    const newChat: Chat = {
      id: uuidv4(),
      title: "New Chat",
      messages: [],
    };
    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
  };

  const addMessageToChat = (message: ChatMessage) => {
    // If no active chat, create one
    if (!activeChatId) {
      const newChat: Chat = {
        id: uuidv4(),
        title: message.content.slice(0, 20) || "New Chat",
        messages: [message],
      };
      setChats([newChat, ...chats]);
      setActiveChatId(newChat.id);
      return;
    }

    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === activeChatId
          ? { ...chat, messages: [...chat.messages, message] }
          : chat
      )
    );
  };

  const updateLastMessageInChat = (id: string, content: string) => {
    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === id
          ? {
              ...chat,
              messages: chat.messages.map((m, i, arr) =>
                i === arr.length - 1 && m.role === "assistant"
                  ? { ...m, content }
                  : m
              ),
            }
          : chat
      )
    );
  };

  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChatId,
        createNewChat,
        setActiveChatId,
        addMessageToChat,
        updateLastMessageInChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}