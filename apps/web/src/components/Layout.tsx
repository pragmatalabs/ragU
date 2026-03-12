import { Sidebar } from "./Sidebar";
import { Chat } from "./Chat";

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Chat />
      </main>
    </div>
  );
}
