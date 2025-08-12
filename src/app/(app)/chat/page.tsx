"use client";

import { useState } from "react";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatPromptInput } from "@/components/chat/ChatPromptInput";
import ChatSidebar from "@/components/chat/ChatSidebar";
import { Chat } from "@/types/chat";

export default function ChatPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // ✅ Create new chat with explicit ID
  const createNewChatWithId = (id: string) => {
    const newChat: Chat = {
      id,
      title: "New Chat",
      messages: [],
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(id);
  };

  // ✅ Add user message to specific chat
  const addUserMessage = (content: string, chatId: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: [...chat.messages, { role: "user", content }],
            }
          : chat
      )
    );
  };

  // ✅ Add empty assistant message to prepare for streaming
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

  // ✅ Stream assistant text into latest assistant message
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
        createNewChat={() => {
          const id = Date.now().toString();
          createNewChatWithId(id);
        }}
      />
      <div className="flex flex-col flex-1">
        <ChatHeader />
        <ChatMessages messages={currentChat?.messages || []} />
        <ChatPromptInput
          activeChatId={activeChatId}
          createNewChatWithId={createNewChatWithId}
          onUserSend={addUserMessage}
          onAssistantStart={addAssistantMessage}
          onAssistantStream={appendToAssistant}
        />
      </div>
    </div>
  );
}