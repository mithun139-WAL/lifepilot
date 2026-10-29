"use client";

import React from "react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: string;
  content: string;
}

interface Props {
  messages: Message[];
  /** Tokens being streamed right now — shown as the live AI bubble */
  streamingContent?: string;
  /** True while the assistant is generating a response */
  isStreaming?: boolean;
}

function stripThinkingTags(content: string): string {
  return content
    .replace(/<think>([\s\S]*?)<\/think>/g, (_, inner: string) => {
      const text = inner.trim();
      return text ? `\n\n> **Thinking:** *${text}*\n\n` : "";
    });
}

function CitationBlock({ content }: { content: string }) {
  const match = content.match(/\[\[CITATIONS\]\]([\s\S]*?)\[\[\/CITATIONS\]\]/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1].trim());
    return (
      <div className="pt-2 mt-2 border-t border-white/[0.08]">
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {data.sources?.map((s: { source: string; snippet?: string }, idx: number) => (
            <div key={idx} className="group relative">
              <span className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 cursor-help hover:bg-violet-500/20 transition-colors">
                <span className="w-1 h-1 bg-violet-400 rounded-full" />
                {s.source}
              </span>
              {s.snippet && (
                <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-900 border border-white/10 rounded-xl shadow-xl text-[11px] text-slate-300 hidden group-hover:block z-10 backdrop-blur-md">
                  <p className="italic">"{s.snippet}"</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className={`flex items-center gap-1 ${data.is_grounded ? "text-emerald-400" : "text-amber-400"}`}>
            {data.is_grounded ? "✓ Grounded in KB" : "⚠ External Knowledge"}
          </span>
          <span className="text-slate-500 uppercase tracking-tighter">
            Confidence: {data.confidence}
          </span>
        </div>
      </div>
    );
  } catch {
    return null;
  }
}

function AssistantBubble({ content, isStreaming = false }: { content: string; isStreaming?: boolean }) {
  const cleanContent = stripThinkingTags(content).replace(
    /\[\[CITATIONS\]\][\s\S]*?\[\[\/CITATIONS\]\]/,
    ""
  ).trim();

  return (
    <div className="flex gap-3 items-start animate-fade-in-up">
      {/* AI avatar */}
      <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center mt-0.5 glow-violet">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>

      <div className="flex-1 min-w-0 surface-2 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%]">
        <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed
                        prose-p:my-1.5 prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10
                        prose-code:text-violet-300 prose-code:bg-violet-500/10 prose-code:px-1 prose-code:rounded">
          <ReactMarkdown>{cleanContent || (isStreaming ? " " : "")}</ReactMarkdown>
        </div>
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-violet-400 rounded-sm ml-0.5 align-middle animate-pulse" />
        )}
        <CitationBlock content={content} />
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end animate-fade-in-up">
      <div className="max-w-[70%] px-4 py-2.5 rounded-2xl rounded-tr-sm
                      bg-gradient-to-br from-violet-600/40 to-violet-700/30
                      border border-violet-500/25 text-slate-100 text-sm leading-relaxed
                      whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

export function ChatMessages({ messages, streamingContent = "", isStreaming = false }: Props) {
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg, i) =>
        msg.role === "user" ? (
          <UserBubble key={i} content={msg.content} />
        ) : (
          <AssistantBubble key={i} content={msg.content} />
        )
      )}

      {/* Live streaming bubble */}
      {isStreaming && (
        <AssistantBubble
          content={streamingContent}
          isStreaming
        />
      )}

      <div ref={endRef} />
    </div>
  );
}
