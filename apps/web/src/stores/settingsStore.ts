import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  model: string;
  ragEnabled: boolean;
  collection: string;
  temperature: number;
  topP: number;
  topK: number;
  systemPrompt: string;
  setModel: (model: string) => void;
  setRagEnabled: (enabled: boolean) => void;
  setCollection: (collection: string) => void;
  setTemperature: (temp: number) => void;
  setTopP: (topP: number) => void;
  setTopK: (topK: number) => void;
  setSystemPrompt: (prompt: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      model: "llama3.2:3b",
      ragEnabled: false,
      collection: "default",
      temperature: 0.7,
      topP: 0.9,
      topK: 5,
      systemPrompt: "",
      setModel: (model) => set({ model }),
      setRagEnabled: (ragEnabled) => set({ ragEnabled }),
      setCollection: (collection) => set({ collection }),
      setTemperature: (temperature) => set({ temperature }),
      setTopP: (topP) => set({ topP }),
      setTopK: (topK) => set({ topK }),
      setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
    }),
    { name: "ragu-settings" }
  )
);
