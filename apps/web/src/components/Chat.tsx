import { useEffect, useRef, useState } from "react";
import { useChat } from "../hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { useSettingsStore } from "../stores/settingsStore";
import { fetchSuggestions } from "../lib/api";
import type { RagSuggestion } from "../lib/types";
import {
  Database,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Clock,
  ShieldAlert,
} from "lucide-react";

const SUGGESTION_CONFIG: Record<
  string,
  { icon: typeof BookOpen; color: string; border: string; label: string }
> = {
  adjacency: {
    icon: BookOpen,
    color: "text-blue-400",
    border: "border-l-blue-500",
    label: "Related Document",
  },
  recency: {
    icon: Clock,
    color: "text-amber-400",
    border: "border-l-amber-500",
    label: "Potentially Outdated",
  },
  risk: {
    icon: ShieldAlert,
    color: "text-red-400",
    border: "border-l-red-500",
    label: "Risk Flag",
  },
};

function SuggestionsPanel({
  suggestions,
  onClickSuggestion,
}: {
  suggestions: RagSuggestion[];
  onClickSuggestion: (s: RagSuggestion) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 pb-3">
      <p className="text-[11px] text-gray-500 mb-2 flex items-center gap-1.5">
        <Lightbulb size={11} />
        Proactive suggestions
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {suggestions.slice(0, 2).map((s) => {
          const config = SUGGESTION_CONFIG[s.type] || SUGGESTION_CONFIG.adjacency;
          const Icon = config.icon;
          return (
            <button
              key={s.id}
              onClick={() => onClickSuggestion(s)}
              className={`group text-left px-3 py-2.5 rounded-lg border border-gray-800 border-l-2 ${config.border} bg-gray-900/50 hover:bg-gray-800 hover:border-gray-700 transition-colors`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} className={config.color} />
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.color}`}>
                  {config.label}
                </span>
              </div>
              <p className="text-xs text-gray-300 font-medium truncate">
                {s.title}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">
                {s.reason}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Chat() {
  const { activeSession, streaming, ragSources, ragSuggestions, sendMessage } =
    useChat();
  const ragEnabled = useSettingsStore((s) => s.ragEnabled);
  const collection = useSettingsStore((s) => s.collection);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages]);

  // Fetch suggestions when chat is empty
  useEffect(() => {
    if (!activeSession || activeSession.messages.length === 0) {
      fetchSuggestions().then(setSuggestions);
    }
  }, [activeSession]);

  const isEmpty = !activeSession || activeSession.messages.length === 0;

  const handleSuggestionClick = (s: RagSuggestion) => {
    sendMessage(`Tell me more about "${s.title}"`);
  };

  return (
    <div className="flex flex-1 flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4 px-4">
            <div className="text-center">
              <div className="text-4xl mb-3">🍲</div>
              <p className="text-lg text-gray-400 font-medium">ragU</p>
              <p className="text-sm mt-1">
                {ragEnabled
                  ? "RAG mode enabled — ask questions about your documents"
                  : "Direct chat — enable RAG in the sidebar to use your documents"}
              </p>
            </div>

            {/* Suggestion chips */}
            {suggestions.length > 0 && (
              <div className="max-w-lg w-full mt-2">
                <p className="text-xs text-gray-600 flex items-center gap-1.5 mb-2 justify-center">
                  <Lightbulb size={12} />
                  Puedes preguntar, por ejemplo:
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {suggestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      disabled={streaming}
                      className="group flex items-start gap-2 text-left px-3 py-2.5 rounded-lg border border-gray-800 bg-gray-900/50 hover:bg-gray-800 hover:border-gray-700 transition-colors text-xs text-gray-400 hover:text-gray-200"
                    >
                      <span className="flex-1 line-clamp-2">{q}</span>
                      <ArrowRight
                        size={12}
                        className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-4">
            {activeSession.messages
              .filter((m) => m.role !== "system")
              .map((msg, i, arr) => (
                <ChatMessage
                  key={i}
                  message={msg}
                  previousMessage={i > 0 ? arr[i - 1] : undefined}
                />
              ))}

            {/* Proactive suggestion cards — after last assistant message */}
            {!streaming && ragSuggestions.length > 0 && (
              <SuggestionsPanel
                suggestions={ragSuggestions}
                onClickSuggestion={handleSuggestionClick}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* RAG Sources — collapsed by default */}
      {ragSources.length > 0 && (
        <div className="border-t border-gray-800 px-4">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => setSourcesOpen(!sourcesOpen)}
              className="flex items-center gap-1.5 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors w-full"
            >
              {sourcesOpen ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
              <Database size={12} />
              Retrieved sources ({ragSources.length})
            </button>
            {sourcesOpen && (
              <div className="flex gap-2 flex-wrap pb-2">
                {ragSources.map((s, i) => {
                  const filename =
                    (s.metadata?.filename as string) ||
                    `chunk #${s.chunk_index}`;
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
            )}
          </div>
        </div>
      )}

      {/* RAG status indicator */}
      <div className="px-4 py-1.5 border-t border-gray-800/50">
        <div className="max-w-3xl mx-auto flex items-center gap-2 text-xs">
          {ragEnabled ? (
            <>
              <Database size={12} className="text-emerald-500" />
              <span className="text-emerald-500">RAG on</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-500">
                collection:{" "}
                <strong className="text-gray-400">
                  {collection || "default"}
                </strong>
              </span>
            </>
          ) : (
            <>
              <AlertTriangle size={12} className="text-yellow-600" />
              <span className="text-yellow-600/70">
                RAG off — uploaded documents won't be used. Enable RAG in the
                sidebar.
              </span>
            </>
          )}
        </div>
      </div>

      <ChatInput onSend={sendMessage} disabled={streaming} />
    </div>
  );
}
