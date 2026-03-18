import { useSettingsStore } from "../stores/settingsStore";

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
    numPredict,
    setNumPredict,
    numCtx,
    setNumCtx,
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

      {/* Context Window (num_ctx) */}
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
