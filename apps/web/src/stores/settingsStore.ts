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

        return state as unknown as SettingsState;
      },
      version: 2,
    }
  )
);
