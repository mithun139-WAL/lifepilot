"use client";

/**
 * src/app/(app)/chat/page.tsx
 *
 * Changes from previous version:
 * - Local broken `authFetcher` copy removed — uses exported `authFetcher` from apiClient
 * - `streamingContent` state: token chunks appended by `onAssistantStream`,
 *   cleared and committed to SWR cache by `onAssistantDone` (no DB re-fetch)
 * - Global SWR `mutate` used in `handleUserSend` / `handleAssistantDone` so that
 *   optimistic updates target the correct cache key even when `activeChatId`
 *   state has not yet been flushed (new-chat race condition fixed)
 * - Chats sorted descending (newest first); normalizes `created_at` / `createdAt`
 * - `titleUpdated` boolean + its effect removed (mutateChats called directly in
 *   `handleAssistantDone`, fire-and-forget)
 * - `loaderDots` animation removed from page (ChatPromptInput owns its own loader)
 * - `ChatEmptyState` shown when no messages and not streaming
 */

import { useState, useEffect, useMemo } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatPromptInput } from "@/components/chat/ChatPromptInput";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatEmptyState from "@/components/chat/ChatEmptyState";
import { useAuth } from "@/context/AuthContext";
import PlannerLoader from "@/components/common/PlannerLoader";
import { apiClient, authFetcher } from "@/lib/apiClient";

export default function ChatPage() {
  const { isAuthenticated } = useAuth();

  const {
    data: chatsResult,
    isLoading: loading,
    mutate: mutateChats,
  } = useSWR<any>(
    isAuthenticated ? apiClient.url("/chats") : null,
    authFetcher,
    { revalidateOnFocus: false }
  );

  const chats = useMemo(() => {
    const raw = chatsResult?.data ?? chatsResult ?? [];
    const list = Array.isArray(raw) ? raw : [];
    return [...list].sort((a, b) => {
      const dateA = new Date(a.created_at ?? a.createdAt ?? 0).getTime();
      const dateB = new Date(b.created_at ?? b.createdAt ?? 0).getTime();
      return dateB - dateA; // newest first
    });
  }, [chatsResult]);

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [pendingPrompt, setPendingPrompt] = useState("");

  // Auto-select the most recent chat when chats load for the first time
  useEffect(() => {
    if (!activeChatId && chats.length > 0) {
      setActiveChatId(chats[0].id);
    }
  }, [chats, activeChatId]);

  const { data: messagesResult } = useSWR<any>(
    activeChatId ? apiClient.url(`/chats/${activeChatId}/messages`) : null,
    authFetcher,
    { revalidateOnFocus: false }
  );

  const messages = useMemo(() => {
    const raw = messagesResult?.data ?? messagesResult ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [messagesResult]);

  const handleCreateNewChat = async () => {
    try {
      const result = await apiClient.post<{ success: boolean; data: { id: string } }>(
        "/chats",
        { title: "New Chat" }
      );
      const chatId = result?.data?.id;
      if (chatId) {
        setActiveChatId(chatId);
        mutateChats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * Called by ChatPromptInput immediately after saving the user message to DB.
   * Uses global SWR mutate so the optimistic update targets the correct key
   * even if the page's activeChatId state hasn't flushed yet (new-chat case).
   */
  const handleUserSend = (userMessage: string, chatId: string) => {
    const key = apiClient.url(`/chats/${chatId}/messages`);
    globalMutate(
      key,
      (prev: any) => ({
        ...(prev && typeof prev === "object" && !Array.isArray(prev) ? prev : {}),
        data: [...(prev?.data ?? []), { role: "user", content: userMessage }],
      }),
      { revalidate: false }
    );
    setIsAssistantLoading(true);
    setStreamingContent("");
  };

  /** Appends each streamed token to local state — zero extra API calls */
  const handleAssistantStream = (chunk: string) => {
    setStreamingContent((prev) => prev + chunk);
  };

  /**
   * Called by ChatPromptInput when stream completes with the full content.
   * Commits the assistant message to the SWR cache without re-fetching from DB.
   */
  const handleAssistantDone = (chatId: string, finalContent: string) => {
    const key = apiClient.url(`/chats/${chatId}/messages`);
    globalMutate(
      key,
      (prev: any) => ({
        ...(prev && typeof prev === "object" && !Array.isArray(prev) ? prev : {}),
        data: [...(prev?.data ?? []), { role: "assistant", content: finalContent }],
      }),
      { revalidate: false }
    );
    setStreamingContent("");
    setIsAssistantLoading(false);
    // Refresh chats list fire-and-forget (title may have been updated)
    mutateChats();
  };

  const showEmptyState = messages.length === 0 && !isAssistantLoading;

  return (
    <div className="flex h-full">
      {loading ? (
        <div className="w-64 flex items-center justify-center">
          <PlannerLoader />
        </div>
      ) : (
        <ChatSidebar
          chats={chats}
          activeChatId={activeChatId}
          setActiveChatId={setActiveChatId}
          createNewChat={handleCreateNewChat}
        />
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {showEmptyState ? (
          <ChatEmptyState onPromptSelect={setPendingPrompt} />
        ) : (
          <ChatMessages
            messages={messages}
            streamingContent={streamingContent}
            isStreaming={isAssistantLoading}
          />
        )}

        <ChatPromptInput
          activeChatId={activeChatId}
          createNewChatWithId={(id) => {
            setActiveChatId(id);
            mutateChats();
          }}
          onUserSend={handleUserSend}
          onAssistantStream={handleAssistantStream}
          onAssistantDone={handleAssistantDone}
          messages={messages}
          initialValue={pendingPrompt}
          onInitialValueConsumed={() => setPendingPrompt("")}
        />
      </div>
    </div>
  );
}
