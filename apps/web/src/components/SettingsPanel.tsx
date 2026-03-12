import { useSettingsStore } from "../stores/settingsStore";
import { ScrollText } from "lucide-react";

export function SettingsPanel() {
  const {
    ragEnabled,
    setRagEnabled,
    temperature,
    setTemperature,
    topP,
    setTopP,
    topK,
    setTopK,
    systemPrompt,
    setSystemPrompt,
  } = useSettingsStore();

  return (
    <div className="space-y-4">
      {/* RAG Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          RAG Mode
        </label>
        <button
          onClick={() => setRagEnabled(!ragEnabled)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            ragEnabled ? "bg-emerald-600" : "bg-gray-700"
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
              ragEnabled ? "left-5" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {/* Temperature */}
      <div>
        <div className="flex justify-between mb-1">
          <label className="text-xs text-gray-400">Temperature</label>
          <span className="text-xs text-gray-500">{temperature.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Top P */}
      <div>
        <div className="flex justify-between mb-1">
          <label className="text-xs text-gray-400">Top P</label>
          <span className="text-xs text-gray-500">{topP.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={topP}
          onChange={(e) => setTopP(parseFloat(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Top K (RAG retrieval count) */}
      {ragEnabled && (
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-gray-400">RAG Top K</label>
            <span className="text-xs text-gray-500">{topK}</span>
          </div>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={topK}
            onChange={(e) => setTopK(parseInt(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>
      )}

      {/* Agent Guidelines / System Prompt */}
      <div>
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-2">
          <ScrollText size={12} />
          Agent Guidelines
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="e.g. You are a helpful assistant that always responds in Spanish. Format answers using markdown with headers, bullet points, and code blocks when relevant."
          rows={4}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500"
        />
        <p className="text-[10px] text-gray-600 mt-1">
          System prompt sent with every message in this session
        </p>
      </div>
    </div>
  );
}
