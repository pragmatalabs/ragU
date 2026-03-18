import { useSettingsStore } from "../stores/settingsStore";
import { Cloud, HardDrive } from "lucide-react";

const GROQ_MODELS = [
  { id: "groq/llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
  { id: "groq/llama-3.1-8b-instant", label: "Llama 3.1 8B (fast)" },
  { id: "groq/gemma2-9b-it", label: "Gemma 2 9B" },
  { id: "groq/mixtral-8x7b-32768", label: "Mixtral 8x7B" },
];

export function SettingsPanel() {
  const {
    provider,
    setProvider,
    model,
    setModel,
    ragEnabled,
    setRagEnabled,
    temperature,
    setTemperature,
    topP,
    setTopP,
    topK,
    setTopK,
    numPredict,
    setNumPredict,
    numCtx,
    setNumCtx,
  } = useSettingsStore();

  const isGroq = provider === "groq";

  return (
    <div className="space-y-4">
      {/* Provider Toggle */}
      <div>
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
          LLM Provider
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => {
              setProvider("groq");
              setModel("groq/llama-3.3-70b-versatile");
            }}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              isGroq
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-gray-300"
            }`}
          >
            <Cloud size={13} />
            Groq Cloud
          </button>
          <button
            onClick={() => {
              setProvider("ollama");
              setModel("llama3.2:3b");
            }}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              !isGroq
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-gray-300"
            }`}
          >
            <HardDrive size={13} />
            Ollama Local
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-1">
          {isGroq ? "Fast cloud inference via Groq API" : "Local models via Ollama (requires GPU for speed)"}
        </p>
      </div>

      {/* Groq Model Selector */}
      {isGroq && (
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Cloud Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            {GROQ_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}

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

      {/* Max Tokens (num_predict) */}
      <div>
        <div className="flex justify-between mb-1">
          <label className="text-xs text-gray-400">Max Tokens</label>
          <span className="text-xs text-gray-500">{numPredict}</span>
        </div>
        <input
          type="range"
          min="64"
          max="4096"
          step="64"
          value={numPredict}
          onChange={(e) => setNumPredict(parseInt(e.target.value))}
          className="w-full accent-blue-500"
        />
        <p className="text-[10px] text-gray-600 mt-0.5">
          Lower = faster responses
        </p>
      </div>

      {/* Context Window (num_ctx) — only for local Ollama */}
      {!isGroq && (
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-gray-400">Context Window</label>
            <span className="text-xs text-gray-500">{numCtx}</span>
          </div>
          <input
            type="range"
            min="512"
            max="8192"
            step="512"
            value={numCtx}
            onChange={(e) => setNumCtx(parseInt(e.target.value))}
            className="w-full accent-blue-500"
          />
          <p className="text-[10px] text-gray-600 mt-0.5">
            Lower = faster, higher = more history
          </p>
        </div>
      )}

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
    </div>
  );
}
