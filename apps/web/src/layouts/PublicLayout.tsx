import { useState } from "react";
import { PublicSidebar } from "../components/PublicSidebar";
import { Chat } from "../components/Chat";
import { AboutModal } from "../components/AboutModal";
import { Info } from "lucide-react";

export function PublicLayout() {
  const [showAbout, setShowAbout] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <PublicSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-gray-800 bg-gray-950 px-4 py-2">
          <span className="text-sm text-gray-400">Chat</span>
          <button
            onClick={() => setShowAbout(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Info size={13} />
            About
          </button>
        </div>

        <Chat />
      </main>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}
