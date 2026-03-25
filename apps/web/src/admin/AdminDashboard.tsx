import { useEffect, useState } from "react";
import { Activity, Database, HardDrive, Server, Cpu, MessageSquare } from "lucide-react";

interface ServiceHealth {
  name: string;
  status: string;
  latencyMs?: number;
}

interface Stats {
  total: number;
  today: number;
  thisWeek: number;
}

const iconMap: Record<string, typeof Database> = {
  PostgreSQL: Database,
  Qdrant: Server,
  MinIO: HardDrive,
  Redis: Activity,
  Ollama: Cpu,
};

export function AdminDashboard() {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, thisWeek: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/health", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => setServices(d.services || []))
        .catch(() => {}),
      fetch("/api/admin/interactions/stats", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => setStats(d))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <h2 className="text-lg font-bold text-white">Dashboard</h2>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Today", value: stats.today },
          { label: "This Week", value: stats.thisWeek },
          { label: "All Time", value: stats.total },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare size={14} className="text-blue-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-gray-600">interactions</p>
          </div>
        ))}
      </div>

      {/* Service health */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3">Service Health</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {services.map((s) => {
            const Icon = iconMap[s.name] || Server;
            const healthy = s.status === "healthy";
            return (
              <div
                key={s.name}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    healthy ? "bg-emerald-900/30" : "bg-red-900/30"
                  }`}
                >
                  <Icon
                    size={18}
                    className={healthy ? "text-emerald-400" : "text-red-400"}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{s.name}</p>
                  <p className={`text-xs ${healthy ? "text-emerald-500" : "text-red-500"}`}>
                    {healthy ? "Healthy" : "Unhealthy"}
                    {s.latencyMs !== undefined && (
                      <span className="text-gray-600 ml-1">{s.latencyMs}ms</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
