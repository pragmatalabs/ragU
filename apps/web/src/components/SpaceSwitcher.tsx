import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Check, Trash2, Save, Layers } from "lucide-react";
import { useSettingsStore } from "../stores/settingsStore";

const EMOJI_OPTIONS = [
  "📐", "📚", "⚖️", "👥", "💰", "🔬", "🏗️", "🛡️",
  "📊", "🎯", "🧪", "📝", "🌐", "🔧", "💡", "🍲",
];

export function SpaceSwitcher() {
  const {
    spaces,
    activeSpaceId,
    collection,
    switchSpace,
    saveCurrentAsSpace,
    updateSpace,
    deleteSpace,
  } = useSettingsStore();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("📚");
  const [newCollection, setNewCollection] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    saveCurrentAsSpace(name, newIcon);
    // Update the collection for the newly created space if user specified one
    if (newCollection.trim()) {
      const store = useSettingsStore.getState();
      const created = store.spaces[store.spaces.length - 1];
      if (created) {
        useSettingsStore.setState({
          collection: newCollection.trim(),
          spaces: store.spaces.map((s) =>
            s.id === created.id ? { ...s, collection: newCollection.trim() } : s
          ),
        });
      }
    }
    setNewName("");
    setNewIcon("📚");
    setNewCollection("");
    setCreating(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
          bg-gray-800/50 border border-gray-700 hover:border-gray-600
          text-gray-300 hover:text-white transition-colors"
      >
        <Layers size={14} className="text-gray-500" />
        <span className="max-w-[140px] truncate">
          {activeSpace ? `${activeSpace.icon} ${activeSpace.name}` : "General"}
        </span>
        <ChevronDown size={12} className="text-gray-500" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Space list */}
          <div className="max-h-60 overflow-y-auto">
            {/* General (no space) */}
            <button
              onClick={() => {
                switchSpace(null);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-800 transition-colors ${
                !activeSpaceId ? "bg-gray-800/60 text-white" : "text-gray-300"
              }`}
            >
              <span className="text-base">🍲</span>
              <span className="flex-1 text-left truncate">General</span>
              {!activeSpaceId && <Check size={14} className="text-blue-400" />}
            </button>

            {spaces.map((space) => (
              <div
                key={space.id}
                className={`group flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-800 transition-colors ${
                  activeSpaceId === space.id ? "bg-gray-800/60 text-white" : "text-gray-300"
                }`}
              >
                <button
                  className="flex items-center gap-3 flex-1 min-w-0"
                  onClick={() => {
                    switchSpace(space.id);
                    setOpen(false);
                  }}
                >
                  <span className="text-base">{space.icon}</span>
                  <div className="flex-1 text-left min-w-0">
                    <div className="truncate">{space.name}</div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {space.collection} · {space.ragEnabled ? "RAG on" : "RAG off"}
                    </div>
                  </div>
                  {activeSpaceId === space.id && (
                    <Check size={14} className="text-blue-400 flex-shrink-0" />
                  )}
                </button>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {activeSpaceId === space.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateSpace(space.id);
                      }}
                      className="p-1 text-gray-500 hover:text-blue-400 transition-colors"
                      title="Save current settings to this space"
                    >
                      <Save size={12} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSpace(space.id);
                    }}
                    className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                    title="Delete space"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800" />

          {/* Create / form */}
          {creating ? (
            <div className="p-3 space-y-2">
              <div className="flex gap-2">
                {/* Emoji picker */}
                <div className="relative group">
                  <button className="w-9 h-9 flex items-center justify-center bg-gray-800 border border-gray-700 rounded-lg text-base hover:border-gray-600">
                    {newIcon}
                  </button>
                  <div className="absolute bottom-full left-0 mb-1 hidden group-hover:grid grid-cols-8 gap-0.5 bg-gray-800 border border-gray-700 rounded-lg p-1.5 z-10 w-max">
                    {EMOJI_OPTIONS.map((e) => (
                      <button
                        key={e}
                        onClick={() => setNewIcon(e)}
                        className={`w-7 h-7 flex items-center justify-center rounded text-sm hover:bg-gray-700 ${
                          newIcon === e ? "bg-gray-700" : ""
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Space name"
                  autoFocus
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <input
                value={newCollection}
                onChange={(e) => setNewCollection(e.target.value)}
                placeholder={`Collection name (default: "${collection}")`}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs py-1.5 rounded-lg transition-colors"
                >
                  Create Space
                </button>
                <button
                  onClick={() => setCreating(false)}
                  className="px-3 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <Plus size={14} />
              Create Space
            </button>
          )}
        </div>
      )}
    </div>
  );
}
