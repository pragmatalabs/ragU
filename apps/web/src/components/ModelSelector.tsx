import { useState } from "react";
import { useModels } from "../hooks/useModels";
import { useSettingsStore } from "../stores/settingsStore";
import { Download, RefreshCw } from "lucide-react";

export function ModelSelector() {
  const { models, loading, pulling, refresh, pull } = useModels();
  const { model, setModel } = useSettingsStore();
  const [pullName, setPullName] = useState("");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Model
        </label>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <select
        value={model}
        onChange={(e) => setModel(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
      >
        {models.map((m) => (
          <option key={m.name} value={m.name}>
            {m.name} ({(m.size / 1e9).toFixed(1)}GB)
          </option>
        ))}
        {models.length === 0 && <option>No models loaded</option>}
      </select>

      <div className="flex gap-2">
        <input
          value={pullName}
          onChange={(e) => setPullName(e.target.value)}
          placeholder="Pull model (e.g. phi3:mini)"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
          onKeyDown={(e) => {
            if (e.key === "Enter" && pullName.trim()) {
              pull(pullName.trim());
              setPullName("");
            }
          }}
        />
        <button
          onClick={() => {
            if (pullName.trim()) {
              pull(pullName.trim());
              setPullName("");
            }
          }}
          disabled={pulling || !pullName.trim()}
          className="p-1.5 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-40 transition-colors"
        >
          <Download size={14} className={pulling ? "animate-bounce" : ""} />
        </button>
      </div>
    </div>
  );
}
