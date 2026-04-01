import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AgentConfigItem, Space } from "../lib/types";

interface SettingsState {
  // Active working state (flat fields — read by useChat, api, etc.)
  provider: string;
  model: string;
  ragEnabled: boolean;
  collection: string;
  temperature: number;
  topP: number;
  topK: number;
  numPredict: number;
  numCtx: number;
  systemPrompt: string; // deprecated — kept for migration
  instructions: AgentConfigItem[];
  skills: AgentConfigItem[];
  guardrails: AgentConfigItem[];
  tools: AgentConfigItem[];

  // Spaces (save/load presets)
  spaces: Space[];
  activeSpaceId: string | null;

  // Flat field setters
  setProvider: (provider: string) => void;
  setModel: (model: string) => void;
  setRagEnabled: (enabled: boolean) => void;
  setCollection: (collection: string) => void;
  setTemperature: (temp: number) => void;
  setTopP: (topP: number) => void;
  setTopK: (topK: number) => void;
  setNumPredict: (n: number) => void;
  setNumCtx: (n: number) => void;
  setSystemPrompt: (prompt: string) => void;
  setInstructions: (items: AgentConfigItem[]) => void;
  setSkills: (items: AgentConfigItem[]) => void;
  setGuardrails: (items: AgentConfigItem[]) => void;
  setTools: (items: AgentConfigItem[]) => void;

  // Space actions
  switchSpace: (id: string | null) => void;
  saveCurrentAsSpace: (name: string, icon: string) => void;
  updateSpace: (id: string) => void;
  deleteSpace: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      provider: "groq",
      model: "groq/llama-3.3-70b-versatile",
      ragEnabled: true,
      collection: "default",
      temperature: 0.3,
      topP: 0.9,
      topK: 10,
      numPredict: 512,
      numCtx: 4096,
      systemPrompt: "",
      instructions: [],
      skills: [],
      guardrails: [],
      tools: [],
      spaces: [],
      activeSpaceId: null,

      setProvider: (provider) => set({ provider }),
      setModel: (model) => set({ model }),
      setRagEnabled: (ragEnabled) => set({ ragEnabled }),
      setCollection: (collection) => set({ collection }),
      setTemperature: (temperature) => set({ temperature }),
      setTopP: (topP) => set({ topP }),
      setTopK: (topK) => set({ topK }),
      setNumPredict: (numPredict) => set({ numPredict }),
      setNumCtx: (numCtx) => set({ numCtx }),
      setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
      setInstructions: (instructions) => set({ instructions }),
      setSkills: (skills) => set({ skills }),
      setGuardrails: (guardrails) => set({ guardrails }),
      setTools: (tools) => set({ tools }),

      switchSpace: (id) => {
        const { spaces } = get();
        if (id === null) {
          set({ activeSpaceId: null });
          return;
        }
        const space = spaces.find((s) => s.id === id);
        if (!space) return;
        set({
          activeSpaceId: id,
          collection: space.collection,
          ragEnabled: space.ragEnabled,
          instructions: space.instructions,
          skills: space.skills,
          guardrails: space.guardrails,
          tools: space.tools,
          topK: space.topK,
        });
      },

      saveCurrentAsSpace: (name, icon) => {
        const s = get();
        const id = Math.random().toString(36).substring(2, 10);
        const newSpace: Space = {
          id,
          name,
          icon,
          collection: s.collection,
          ragEnabled: s.ragEnabled,
          instructions: s.instructions,
          skills: s.skills,
          guardrails: s.guardrails,
          tools: s.tools,
          topK: s.topK,
        };
        set({ spaces: [...s.spaces, newSpace], activeSpaceId: id });
      },

      updateSpace: (id) => {
        const s = get();
        set({
          spaces: s.spaces.map((sp) =>
            sp.id === id
              ? {
                  ...sp,
                  collection: s.collection,
                  ragEnabled: s.ragEnabled,
                  instructions: s.instructions,
                  skills: s.skills,
                  guardrails: s.guardrails,
                  tools: s.tools,
                  topK: s.topK,
                }
              : sp
          ),
        });
      },

      deleteSpace: (id) => {
        const s = get();
        set({
          spaces: s.spaces.filter((sp) => sp.id !== id),
          activeSpaceId: s.activeSpaceId === id ? null : s.activeSpaceId,
        });
      },
    }),
    {
      name: "ragu-settings",
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;

        // v0→v1: Migrate old systemPrompt to instructions array
        if (
          version < 1 &&
          state &&
          typeof state.systemPrompt === "string" &&
          state.systemPrompt &&
          (!Array.isArray(state.instructions) || state.instructions.length === 0)
        ) {
          state.instructions = [
            {
              id: "migrated-" + Date.now(),
              name: "Agent Guidelines",
              content: state.systemPrompt,
              enabled: true,
            },
          ];
          state.systemPrompt = "";
        }

        // v1→v2: Add default proactive RAG persona if no instructions exist
        if (
          version < 2 &&
          state &&
          (!Array.isArray(state.instructions) || state.instructions.length === 0)
        ) {
          state.instructions = [
            {
              id: "persona-proactive-rag",
              name: "Proactive RAG Persona",
              content:
                "You are a knowledge assistant with access to the user's document collection.\n\n" +
                "ANSWER BEHAVIOR:\n" +
                "- Answer the user's explicit question first, concisely.\n" +
                "- Cite your sources by document name.\n" +
                "- If retrieved context is insufficient, state this clearly.\n\n" +
                "PROACTIVE SUGGESTION RULES:\n" +
                "- After your answer, if the system provides proactive suggestions, present them below a --- separator.\n" +
                "- For each suggestion, state the type (Related, Outdated, Risk) and a one-line explanation.\n" +
                "- Cap at 2 suggestions. Be specific — cite the document title and reason.\n" +
                "- Never interrupt the main answer with suggestions.\n\n" +
                "TONE:\n" +
                "- Match the user's register (formal vs casual).\n" +
                "- Be concise. Prefer bullet points over paragraphs.",
              enabled: true,
            },
          ];
        }

        // v2→v3: Initialize spaces array
        if (version < 3 && state) {
          if (!Array.isArray(state.spaces)) {
            state.spaces = [];
          }
          if (state.activeSpaceId === undefined) {
            state.activeSpaceId = null;
          }
        }

        return state as unknown as SettingsState;
      },
      version: 3,
    }
  )
);
