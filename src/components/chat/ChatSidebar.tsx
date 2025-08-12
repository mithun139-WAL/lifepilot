import { Plus } from "lucide-react";

interface SidebarProps {
  chats: { id: string; title: string }[];
  activeChatId: string | null;
  setActiveChatId: (id: string) => void;
  createNewChat: () => void;
}

export default function ChatSidebar({
  chats,
  activeChatId,
  setActiveChatId,
  createNewChat,
}: SidebarProps) {
  return (
    <aside className="w-64 bg-slate-900 text-white border-r border-slate-800 p-4 space-y-4">
      <button
        onClick={createNewChat}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg w-full"
      >
        <Plus size={18} />
        New Chat
      </button>

      <div className="space-y-2">
        {chats.map((conv) => (
          <div
            key={conv.id}
            onClick={() => setActiveChatId(conv.id)}
            className={`cursor-pointer px-3 py-2 rounded-md hover:bg-slate-800 transition-all ${
              activeChatId === conv.id
                ? "bg-slate-800 font-semibold border-l-4 border-blue-500"
                : ""
            }`}
          >
            {conv.title}
          </div>
        ))}
      </div>
    </aside>
  );
}