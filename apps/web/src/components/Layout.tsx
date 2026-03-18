import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Chat } from "./Chat";
import { DocumentsPanel } from "./DocumentsPanel";
import { AgentPanel } from "./AgentPanel";
import { MessageSquare, FolderOpen, Bot } from "lucide-react";

type Tab = "chat" | "documents" | "agent";

const tabs: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "documents", label: "Documents", icon: FolderOpen },
  { id: "agent", label: "Agent", icon: Bot },
];

export function Layout() {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-800 bg-gray-950 px-4">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                  tab === t.id
                    ? "border-blue-500 text-white"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                <Icon size={15} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === "chat" && <Chat />}
        {tab === "documents" && <DocumentsPanel />}
        {tab === "agent" && <AgentPanel />}
      </main>
    </div>
  );
}
