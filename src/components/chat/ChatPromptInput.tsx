"use client";

/**
 * src/components/chat/ChatPromptInput.tsx
 *
 * Changes from previous version:
 * - getChatDetails() removed — eliminates redundant GET /chats/{id} round-trip.
 *   New logic: if activeChatId is null → create chat; if messages.length === 0
 *   → fire-and-forget title update. No extra API calls needed.
 * - updateChatTitle() is now fire-and-forget (no await) — unblocks streaming.
 * - <input> replaced with auto-resize <textarea> — handles multi-line prompts.
 * - Enter submits (Shift+Enter = newline); Cmd/Ctrl+Enter also submits.
 * - Removed: onAssistantStart, setAssistantLoading, onChatsLoad, setTitleUpdated
 *   props — parent handles all of that via onUserSend / onAssistantDone.
 * - onAssistantDone signature extended to pass finalContent to parent so the
 *   parent can commit the message to SWR cache without a DB re-fetch.
 * - initialValue / onInitialValueConsumed: supports suggested-prompt injection
 *   from ChatEmptyState.
 */

import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getAccessToken } from "@/lib/tokenStore";
import { apiClient } from "@/lib/apiClient";

interface ChatPromptInputProps {
  activeChatId: string | null;
  createNewChatWithId: (id: string) => void;
  onUserSend: (content: string, chatId: string) => void;
  onAssistantStream: (chunk: string) => void;
  onAssistantDone: (chatId: string, finalContent: string) => void;
  messages: { role: string; content: string }[];
  /** Pre-fill the textarea (e.g. from a suggested prompt card) */
  initialValue?: string;
  onInitialValueConsumed?: () => void;
}

export function ChatPromptInput({
  activeChatId,
  createNewChatWithId,
  onUserSend,
  onAssistantStream,
  onAssistantDone,
  messages,
  initialValue,
  onInitialValueConsumed,
}: ChatPromptInputProps) {
  const { isAuthenticated } = useAuth();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pre-fill textarea from suggested-prompt injection
  useEffect(() => {
    if (initialValue) {
      setInput(initialValue);
      onInitialValueConsumed?.();
      textareaRef.current?.focus();
      // Trigger height recalculation
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
        }
      }, 0);
    }
  }, [initialValue, onInitialValueConsumed]);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  const createNewChat = async (firstMessage: string) => {
    const result = await apiClient.post<{ success: boolean; data: { id: string } }>(
      "/chats",
      { title: firstMessage.slice(0, 40) }
    );
    return result?.data?.id ?? null;
  };

  /** Fire-and-forget — does NOT block streaming */
  const updateChatTitle = (chatId: string, userMessage: string) => {
    apiClient
      .put(`/chats/${chatId}`, { title: userMessage.slice(0, 40) })
      .catch(() => {}); // silent fail — title update is cosmetic
  };

  const saveMessage = (chatId: string, role: string, content: string) =>
    apiClient.post(`/chats/${chatId}/messages`, { role, content });

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!input.trim() || !isAuthenticated || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // ── Resolve chat ID ────────────────────────────────────────────────────
    let chatId = activeChatId;

    if (!chatId) {
      // Brand-new session: create chat with the message as title
      chatId = await createNewChat(userMessage);
      if (!chatId) {
        console.error("[ChatPromptInput] Failed to create chat");
        return;
      }
      createNewChatWithId(chatId);
    } else if (messages.length === 0) {
      // First message in an existing blank chat — update title (non-blocking)
      updateChatTitle(chatId, userMessage);
    }

    setIsLoading(true);

    // ── Persist user message ───────────────────────────────────────────────
    await saveMessage(chatId, "user", userMessage);
    onUserSend(userMessage, chatId);

    // ── Build context window (last 10 messages) ────────────────────────────
    const history = messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // ── Stream from FastAPI /chat/stream ───────────────────────────────────
    let assistantContent = "";
    try {
      const res = await fetch(apiClient.url("/chat/stream"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken() ?? ""}`,
        },
        body: JSON.stringify({
          messages: [...history, { role: "user", content: userMessage }],
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value);
        assistantContent += chunk;
        onAssistantStream(chunk);
      }
    } catch (err) {
      console.error("[ChatPromptInput] Stream error:", err);
    }

    // ── Persist assistant message ──────────────────────────────────────────
    if (assistantContent) {
      await saveMessage(chatId, "assistant", assistantContent);
    }

    setIsLoading(false);
    onAssistantDone(chatId, assistantContent);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="shrink-0 px-4 py-3 border-t border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
      <form
        className="flex items-end gap-2 surface-elevated p-2 rounded-2xl"
        onSubmit={handleSubmit}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
          disabled={isLoading}
          style={{ resize: "none", overflow: "hidden" }}
          className="flex-1 min-w-0 bg-transparent text-sm text-slate-100 placeholder:text-slate-500
                     outline-none leading-relaxed py-1 px-2 disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center
                     bg-violet-600 hover:bg-violet-500 disabled:bg-white/10
                     disabled:text-slate-500 text-white transition-all duration-150
                     cursor-pointer disabled:cursor-not-allowed glow-violet"
        >
          {isLoading ? (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <Send size={14} strokeWidth={2} />
          )}
        </button>
      </form>

      <p className="mt-1 text-center text-[10px] text-slate-600 select-none">
        LifePilot AI may make mistakes. Verify important information.
      </p>
    </div>
  );
}
