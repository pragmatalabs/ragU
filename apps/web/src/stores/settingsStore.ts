import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AgentConfigItem } from "../lib/types";

interface SettingsState {
  provider: string; // "ollama" | "groq"
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
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      provider: "ollama",
      model: "llama3.2:3b",
      ragEnabled: false,
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
    }),
    {
      name: "ragu-settings",
      migrate: (persisted: unknown) => {
        const state = persisted as Record<string, unknown>;
        // Migrate old systemPrompt to instructions array
        if (
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
        return state as unknown as SettingsState;
      },
      version: 1,
    }
  )
);
