import { useChatStore } from "../stores/chatStore";
import { ModelSelector } from "./ModelSelector";
import { DocumentUpload } from "./DocumentUpload";
import { SettingsPanel } from "./SettingsPanel";
import { Plus, Trash2, MessageSquare } from "lucide-react";

export function Sidebar() {
  const { sessions, activeSessionId, createSession, setActiveSession, deleteSession } =
    useChatStore();

  return (
    <aside className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold tracking-tight">
            rag<span className="text-blue-400">U</span>
          </h1>
          <button
            onClick={createSession}
            className="p-1.5 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
            title="New chat"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Chat Sessions */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => setActiveSession(s.id)}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
              s.id === activeSessionId
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
            }`}
          >
            <MessageSquare size={14} className="flex-shrink-0" />
            <span className="flex-1 truncate">{s.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteSession(s.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Settings */}
      <div className="border-t border-gray-800 p-4 space-y-4 overflow-y-auto max-h-[50vh]">
        <ModelSelector />
        <DocumentUpload />
        <SettingsPanel />
      </div>
    </aside>
  );
}
