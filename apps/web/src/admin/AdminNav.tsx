import { NavLink } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import {
  LayoutDashboard,
  MessageSquare,
  FolderOpen,
  Bot,
  ScrollText,
  LogOut,
} from "lucide-react";

const links = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/chat", label: "Chat", icon: MessageSquare, end: false },
  { to: "/admin/documents", label: "Documents", icon: FolderOpen, end: false },
  { to: "/admin/agent", label: "Agent", icon: Bot, end: false },
  { to: "/admin/interactions", label: "Interactions", icon: ScrollText, end: false },
];

export function AdminNav() {
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-bold tracking-tight">
          rag<span className="text-blue-400">U</span>
          <span className="text-xs text-gray-500 ml-2 font-normal">admin</span>
        </h1>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-2 space-y-0.5">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                }`
              }
            >
              <Icon size={15} />
              {l.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-gray-800 p-3">
        <button
          onClick={logout}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-red-400 transition-colors w-full px-3 py-2"
        >
          <LogOut size={13} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
