import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { AdminLogin } from "./AdminLogin";
import { AdminNav } from "./AdminNav";
import { AdminDashboard } from "./AdminDashboard";
import { AdminInteractions } from "./AdminInteractions";
import { Chat } from "../components/Chat";
import { DocumentsPanel } from "../components/DocumentsPanel";
import { AgentPanel } from "../components/AgentPanel";
import { Sidebar } from "../components/Sidebar";

function AdminShell() {
  return (
    <div className="flex h-screen overflow-hidden">
      <AdminNav />
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar for chat/documents/agent views */}
        <Routes>
          <Route path="chat" element={<WithSidebar><Chat /></WithSidebar>} />
          <Route path="documents" element={<WithSidebar><DocumentsPanel /></WithSidebar>} />
          <Route path="agent" element={<WithSidebar><AgentPanel /></WithSidebar>} />
          <Route path="interactions" element={<AdminInteractions />} />
          <Route path="" element={<AdminDashboard />} />
        </Routes>
      </div>
    </div>
  );
}

function WithSidebar({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </>
  );
}

export default function AdminLayout() {
  const { authenticated, loading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-500 text-sm">
        Checking authentication...
      </div>
    );
  }

  if (!authenticated) {
    return <AdminLogin />;
  }

  return <AdminShell />;
}
