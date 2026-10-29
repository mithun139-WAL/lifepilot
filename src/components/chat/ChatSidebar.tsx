"use client";

import { Plus, MessageSquare } from "lucide-react";

interface ChatItem {
  id: string;
  title: string;
  created_at?: string;
  createdAt?: string;
}

interface SidebarProps {
  chats: ChatItem[];
  activeChatId: string | null;
  setActiveChatId: (id: string) => void;
  createNewChat: () => void;
}

function getDateGroup(chat: ChatItem): string {
  const raw = chat.created_at ?? chat.createdAt;
  if (!raw) return "Earlier";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const weekStart = new Date(todayStart.getTime() - 7 * 86_400_000);
  const date = new Date(raw);

  if (date >= todayStart) return "Today";
  if (date >= yesterdayStart) return "Yesterday";
  if (date >= weekStart) return "This Week";
  return "Earlier";
}

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "Earlier"] as const;

export default function ChatSidebar({
  chats,
  activeChatId,
  setActiveChatId,
  createNewChat,
}: SidebarProps) {
  // Build ordered groups — only include non-empty ones
  const groups = GROUP_ORDER.reduce<Record<string, ChatItem[]>>((acc, label) => {
    acc[label] = [];
    return acc;
  }, {} as Record<string, ChatItem[]>);

  for (const chat of chats) {
    groups[getDateGroup(chat)].push(chat);
  }

  return (
    <aside className="w-64 flex flex-col border-r border-white/[0.08] bg-white/[0.03] backdrop-blur-sm shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-white/[0.06]">
        <button
          onClick={createNewChat}
          className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl
                     bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30
                     hover:border-violet-400/50 text-violet-300 hover:text-violet-200
                     text-sm font-medium transition-all duration-200 cursor-pointer
                     glow-violet"
        >
          <Plus size={15} strokeWidth={2.5} />
          New Chat
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center gap-2 pt-8 px-4 text-center">
            <MessageSquare size={28} className="text-white/20" />
            <p className="text-slate-500 text-xs">No conversations yet</p>
          </div>
        ) : (
          GROUP_ORDER.map((label) => {
            const items = groups[label];
            if (!items.length) return null;
            return (
              <div key={label}>
                <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 select-none">
                  {label}
                </p>
                <div className="space-y-0.5">
                  {items.map((chat) => {
                    const isActive = chat.id === activeChatId;
                    return (
                      <button
                        key={chat.id}
                        onClick={() => setActiveChatId(chat.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-all duration-150 cursor-pointer
                          ${
                            isActive
                              ? "bg-violet-500/15 border border-violet-500/25 text-violet-200"
                              : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200 border border-transparent"
                          }`}
                      >
                        {chat.title?.trim() || "Untitled Chat"}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
