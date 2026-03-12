import { create } from "zustand";
import type { ChatSession, Message, RagSource } from "../lib/types";

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  ragSources: RagSource[];
  streaming: boolean;

  createSession: () => string;
  setActiveSession: (id: string) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateLastAssistantMessage: (sessionId: string, content: string) => void;
  setRagSources: (sources: RagSource[]) => void;
  setStreaming: (streaming: boolean) => void;
  deleteSession: (id: string) => void;
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export const useChatStore = create<ChatState>()((set, _get) => ({
  sessions: [],
  activeSessionId: null,
  ragSources: [],
  streaming: false,

  createSession: () => {
    const id = generateId();
    const session: ChatSession = {
      id,
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
    };
    set((s) => ({
      sessions: [session, ...s.sessions],
      activeSessionId: id,
      ragSources: [],
    }));
    return id;
  },

  setActiveSession: (id) => set({ activeSessionId: id, ragSources: [] }),

  addMessage: (sessionId, message) =>
    set((s) => ({
      sessions: s.sessions.map((session) => {
        if (session.id !== sessionId) return session;
        const updated = {
          ...session,
          messages: [...session.messages, message],
        };
        // Set title from first user message
        if (
          message.role === "user" &&
          session.messages.length === 0
        ) {
          updated.title = message.content.slice(0, 40);
        }
        return updated;
      }),
    })),

  updateLastAssistantMessage: (sessionId, content) =>
    set((s) => ({
      sessions: s.sessions.map((session) => {
        if (session.id !== sessionId) return session;
        const msgs = [...session.messages];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant") {
          msgs[msgs.length - 1] = { ...last, content };
        }
        return { ...session, messages: msgs };
      }),
    })),

  setRagSources: (sources) => set({ ragSources: sources }),
  setStreaming: (streaming) => set({ streaming }),

  deleteSession: (id) =>
    set((s) => {
      const sessions = s.sessions.filter((session) => session.id !== id);
      return {
        sessions,
        activeSessionId:
          s.activeSessionId === id
            ? sessions[0]?.id ?? null
            : s.activeSessionId,
      };
    }),
}));
