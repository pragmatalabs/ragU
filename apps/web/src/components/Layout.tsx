import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Chat } from "./Chat";
import { DocumentsPanel } from "./DocumentsPanel";
import { AgentPanel } from "./AgentPanel";
import { SpaceSwitcher } from "./SpaceSwitcher";
import { MessageSquare, FolderOpen, Bot, Info, X, Github, Mail, Linkedin } from "lucide-react";

type Tab = "chat" | "documents" | "agent";

const tabs: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "documents", label: "Documents", icon: FolderOpen },
  { id: "agent", label: "Agent", icon: Bot },
];

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
          <div className="text-4xl mb-3">🍲</div>
          <h2 className="text-xl font-bold text-white">ragU</h2>
          <p className="text-xs text-gray-500 mt-1">Local LLM & RAG Playground</p>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 space-y-4">
          <p className="text-sm text-gray-300 text-center leading-relaxed">
            This is an experimental playground for testing LLMs, RAG pipelines,
            and vector databases locally. The source code is free and open on GitHub
            — use it at your own discretion.
          </p>

          <div className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Author</p>
            <p className="text-sm font-semibold text-white">Julian De La Rosa</p>
            <div className="flex flex-col gap-1.5 text-xs text-gray-400">
              <a
                href="mailto:juliandelarosa@icloud.com"
                className="flex items-center gap-2 hover:text-blue-400 transition-colors"
              >
                <Mail size={12} /> juliandelarosa@icloud.com
              </a>
              <a
                href="https://github.com/pragmatalabs/ragU"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-blue-400 transition-colors"
              >
                <Github size={12} /> github.com/pragmatalabs/ragU
              </a>
              <a
                href="https://www.linkedin.com/in/jdlrs/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-blue-400 transition-colors"
              >
                <Linkedin size={12} /> linkedin.com/in/jdlrs
              </a>
            </div>
          </div>

          <p className="text-center text-[10px] text-gray-600">
            MIT License &middot; 2026 &middot; Built with curiosity
          </p>
        </div>
      </div>
    </div>
  );
}

export function Layout() {
  const [tab, setTab] = useState<Tab>("chat");
  const [showAbout, setShowAbout] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-800 bg-gray-950 px-4">
          <div className="flex flex-1">
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

          {/* Space switcher + About */}
          <div className="flex items-center gap-2">
            <SpaceSwitcher />
          </div>
          <button
            onClick={() => setShowAbout(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Info size={13} />
            About
          </button>
        </div>

        {/* Tab content */}
        {tab === "chat" && <Chat />}
        {tab === "documents" && <DocumentsPanel />}
        {tab === "agent" && <AgentPanel />}
      </main>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}
