import { useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import type { AgentConfigItem } from "../lib/types";
import {
  Plus,
  Trash2,
  ScrollText,
  Sparkles,
  Shield,
  Wrench,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type SubTab = "instructions" | "skills" | "guardrails" | "tools";

const subTabs: {
  id: SubTab;
  label: string;
  icon: typeof ScrollText;
  hint: string;
  placeholder: string;
}[] = [
  {
    id: "instructions",
    label: "Instructions",
    icon: ScrollText,
    hint: "Define the agent's persona, role, and response format. These are prepended to every message.",
    placeholder:
      "e.g. You are a senior Python developer. Always explain your reasoning step by step. Use markdown formatting with headers and code blocks.",
  },
  {
    id: "skills",
    label: "Skills",
    icon: Sparkles,
    hint: "Reusable capabilities the agent can invoke. Each skill describes what the agent can do and how.",
    placeholder:
      "e.g. Analyze code for bugs, security issues, and best practices. Provide specific line references and suggested fixes.",
  },
  {
    id: "guardrails",
    label: "Guardrails",
    icon: Shield,
    hint: "Safety rules and output constraints. Use these to prevent unwanted behavior.",
    placeholder:
      "e.g. Never generate SQL DELETE or DROP statements. Always ask for confirmation before suggesting destructive actions.",
  },
  {
    id: "tools",
    label: "Tools",
    icon: Wrench,
    hint: "Tool and function descriptions the agent can reference. Describe available tools so the agent knows what it can use.",
    placeholder:
      "e.g. web_search: Search the web for current information. Parameters: query (string), max_results (number, default 5).",
  },
];

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function ConfigItemCard({
  item,
  onUpdate,
  onDelete,
  placeholder,
}: {
  item: AgentConfigItem;
  onUpdate: (updated: AgentConfigItem) => void;
  onDelete: () => void;
  placeholder: string;
}) {
  const [expanded, setExpanded] = useState(item.content === "");

  return (
    <div className="bg-gray-800/50 border border-gray-800 rounded-lg overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        {/* Toggle switch */}
        <button
          onClick={() => onUpdate({ ...item, enabled: !item.enabled })}
          className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${
            item.enabled ? "bg-emerald-600" : "bg-gray-700"
          }`}
        >
          <span
            className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
              item.enabled ? "left-4" : "left-0.5"
            }`}
          />
        </button>

        {/* Name input */}
        <input
          value={item.name}
          onChange={(e) => onUpdate({ ...item, name: e.target.value })}
          className={`flex-1 bg-transparent text-sm font-medium focus:outline-none ${
            item.enabled ? "text-white" : "text-gray-500"
          }`}
          placeholder="Untitled"
        />

        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="text-gray-600 hover:text-red-400 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Content textarea (expandable) */}
      {expanded && (
        <div className="px-4 pb-3">
          <textarea
            value={item.content}
            onChange={(e) => onUpdate({ ...item, content: e.target.value })}
            placeholder={placeholder}
            rows={4}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 resize-y focus:outline-none focus:border-blue-500"
          />
        </div>
      )}
    </div>
  );
}

export function AgentPanel() {
  const [subTab, setSubTab] = useState<SubTab>("instructions");
  const {
    instructions,
    skills,
    guardrails,
    tools,
    setInstructions,
    setSkills,
    setGuardrails,
    setTools,
    spaces,
    activeSpaceId,
    updateSpace,
  } = useSettingsStore();

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  const configMap: Record<
    SubTab,
    {
      items: AgentConfigItem[];
      setter: (items: AgentConfigItem[]) => void;
    }
  > = {
    instructions: { items: instructions, setter: setInstructions },
    skills: { items: skills, setter: setSkills },
    guardrails: { items: guardrails, setter: setGuardrails },
    tools: { items: tools, setter: setTools },
  };

  const current = configMap[subTab];
  const tabMeta = subTabs.find((t) => t.id === subTab)!;

  const handleAdd = () => {
    current.setter([
      ...current.items,
      {
        id: generateId(),
        name: "",
        content: "",
        enabled: true,
      },
    ]);
  };

  const handleUpdate = (index: number, updated: AgentConfigItem) => {
    const next = [...current.items];
    next[index] = updated;
    current.setter(next);
  };

  const handleDelete = (index: number) => {
    current.setter(current.items.filter((_, i) => i !== index));
  };

  const enabledCount = (items: AgentConfigItem[]) =>
    items.filter((i) => i.enabled && i.content.trim()).length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Active space banner */}
        {activeSpace && (
          <div className="flex items-center justify-between bg-blue-950/30 border border-blue-900/50 rounded-lg px-4 py-2.5">
            <span className="text-sm text-blue-300">
              Editing agent for: <strong>{activeSpace.icon} {activeSpace.name}</strong>
            </span>
            <button
              onClick={() => updateSpace(activeSpace.id)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Save to space
            </button>
          </div>
        )}

        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-white">
            Agent Configuration
          </h2>
          <p className="text-sm text-gray-500">
            Configure how the agent behaves, what it can do, and what it should
            avoid. Enabled items are compiled into the system prompt.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
          {subTabs.map((t) => {
            const Icon = t.icon;
            const count = enabledCount(configMap[t.id].items);
            return (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors flex-1 justify-center ${
                  subTab === t.id
                    ? "bg-gray-800 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <Icon size={13} />
                {t.label}
                {count > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Hint */}
        <p className="text-xs text-gray-500 bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-3">
          {tabMeta.hint}
        </p>

        {/* Items list */}
        <div className="space-y-2">
          {current.items.map((item, i) => (
            <ConfigItemCard
              key={item.id}
              item={item}
              onUpdate={(updated) => handleUpdate(i, updated)}
              onDelete={() => handleDelete(i)}
              placeholder={tabMeta.placeholder}
            />
          ))}

          {current.items.length === 0 && (
            <div className="text-center py-8 text-gray-600 text-sm">
              No {tabMeta.label.toLowerCase()} configured yet
            </div>
          )}
        </div>

        {/* Add button */}
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 border border-dashed border-gray-700 rounded-lg text-sm text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-colors w-full justify-center"
        >
          <Plus size={14} />
          Add {tabMeta.label.slice(0, -1).toLowerCase()}
        </button>
      </div>
    </div>
  );
}
