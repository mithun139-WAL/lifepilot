// import ReactMarkdown from "react-markdown";
interface Props {
  messages: { role: string; content: string }[];
}

function formatMessageForMarkdown(message: string): string {
  return message.replace(
    /<think>([\s\S]*?)<\/think>/g,
    (_, content: string) => {
      const text = content.trim();
      return text
        ? `<div class="text-xs italic text-slate-400"><b class="text-slate-400">_Thinking</b>\n ${text}</div>\n\n`
        : "";
    }
  );
}

export function ChatMessages({ messages }: Props) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        Start a new conversation...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-4 p-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`p-3 rounded-xl shadow-sm text-sm whitespace-pre-wrap ${
            msg.role === "user"
              ? "ml-auto bg-blue-500/20 text-blue-200 w-auto max-w-[50%]"
              : "bg-slate-800 text-white max-w-[85%]"
          }`}
        >
          {msg.role === "assistant" ? (
            <div
              className="prose prose-invert prose-sm"
              dangerouslySetInnerHTML={{
                __html: formatMessageForMarkdown(msg.content),
              }}
            />
          ) : (
            msg.content
          )}
        </div>
      ))}
    </div>
  );
}
