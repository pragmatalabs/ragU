import { useState } from "react";
import { PublicSidebar } from "../components/PublicSidebar";
import { Chat } from "../components/Chat";
import { AboutModal } from "../components/AboutModal";
import { Info, Menu } from "lucide-react";

export function PublicLayout() {
  const [showAbout, setShowAbout] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar: hidden on mobile by default, slide-in on toggle */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <PublicSidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-gray-800 bg-gray-950 px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors md:hidden"
            >
              <Menu size={18} />
            </button>
            <span className="text-sm text-gray-400 hidden sm:inline">Chat</span>
            <span className="text-sm font-bold sm:hidden">
              rag<span className="text-blue-400">U</span>
            </span>
          </div>
          <button
            onClick={() => setShowAbout(true)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Info size={13} />
            <span className="hidden sm:inline">About</span>
          </button>
        </div>

        <Chat />
      </main>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}
