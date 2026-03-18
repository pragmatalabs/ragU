import { useState } from "react";
import { useModels } from "../hooks/useModels";
import { useSettingsStore } from "../stores/settingsStore";
import { Download, RefreshCw, Cloud, Cpu } from "lucide-react";

export function ModelSelector() {
  const { models, loading, pulling, refresh, pull } = useModels();
  const { model, setModel, provider, setProvider } = useSettingsStore();
  const [pullName, setPullName] = useState("");

  const handleModelChange = (name: string) => {
    setModel(name);
    // Auto-detect provider from model name
    setProvider(name.startsWith("groq/") ? "groq" : "ollama");
  };

  const ollamaModels = models.filter((m) => !m.name.startsWith("groq/"));
  const groqModels = models.filter((m) => m.name.startsWith("groq/"));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Model
        </label>
        <div className="flex items-center gap-2">
          {provider === "groq" ? (
            <span className="flex items-center gap-1 text-[10px] text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded">
              <Cloud size={10} /> Groq
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
              <Cpu size={10} /> Local
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <select
        value={model}
        onChange={(e) => handleModelChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
      >
        {ollamaModels.length > 0 && (
          <optgroup label="Local (Ollama)">
            {ollamaModels.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} ({(m.size / 1e9).toFixed(1)}GB)
              </option>
            ))}
          </optgroup>
        )}
        {groqModels.length > 0 && (
          <optgroup label="Cloud (Groq)">
            {groqModels.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name.replace("groq/", "")} ({(m.size / 1e9).toFixed(0)}B)
              </option>
            ))}
          </optgroup>
        )}
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
