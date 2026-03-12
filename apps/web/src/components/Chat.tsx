import { useEffect, useRef } from "react";
import { useChat } from "../hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { useSettingsStore } from "../stores/settingsStore";
import { Database, MessageSquare } from "lucide-react";

export function Chat() {
  const { activeSession, streaming, ragSources, sendMessage } = useChat();
  const ragEnabled = useSettingsStore((s) => s.ragEnabled);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages]);

  return (
    <div className="flex flex-1 flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {!activeSession || activeSession.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
            <MessageSquare size={48} strokeWidth={1} />
            <p className="text-lg">Start a conversation</p>
            <p className="text-sm">
              {ragEnabled
                ? "RAG mode enabled - upload documents first"
                : "Direct chat with your local LLM"}
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-4">
            {activeSession.messages
              .filter((m) => m.role !== "system")
              .map((msg, i) => (
                <ChatMessage key={i} message={msg} />
              ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* RAG Sources */}
      {ragSources.length > 0 && (
        <div className="border-t border-gray-800 px-4 py-2 max-h-32 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Database size={12} /> Retrieved sources
            </p>
            <div className="flex gap-2 flex-wrap">
              {ragSources.map((s, i) => {
                const filename =
                  (s.metadata?.filename as string) || `chunk #${s.chunk_index}`;
                const shortName =
                  filename.length > 30
                    ? filename.slice(0, 27) + "..."
                    : filename;
                return (
                  <span
                    key={i}
                    className="text-xs bg-gray-800 px-2 py-1 rounded border border-gray-700 cursor-help"
                    title={`${filename}\n\n${s.content.slice(0, 200)}...`}
                  >
                    {shortName} ({(s.score * 100).toFixed(1)}%)
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <ChatInput onSend={sendMessage} disabled={streaming} />
    </div>
  );
}
