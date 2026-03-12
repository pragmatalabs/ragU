import { useCallback } from "react";
import { useChatStore } from "../stores/chatStore";
import { useSettingsStore } from "../stores/settingsStore";
import { streamChat, ragQuery } from "../lib/api";
import type { Message } from "../lib/types";

export function useChat() {
  const {
    sessions,
    activeSessionId,
    streaming,
    ragSources,
    createSession,
    addMessage,
    updateLastAssistantMessage,
    setRagSources,
    setStreaming,
  } = useChatStore();

  const { model, ragEnabled, collection, temperature, topP, topK, systemPrompt } =
    useSettingsStore();

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const sendMessage = useCallback(
    async (content: string) => {
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = createSession();
      }

      const userMessage: Message = { role: "user", content };
      addMessage(sessionId, userMessage);

      const allMessages = [
        ...(activeSession?.messages ?? []),
        userMessage,
      ];

      // Build system prompt from agent guidelines + RAG context
      let messagesForLLM = allMessages;
      const systemParts: string[] = [];

      // Agent guidelines (always prepended if set)
      if (systemPrompt.trim()) {
        systemParts.push(systemPrompt.trim());
      }

      // RAG context
      if (ragEnabled) {
        try {
          const result = await ragQuery(content, collection, topK);
          setRagSources(result.sources);

          if (result.context) {
            systemParts.push(
              `Use the following context to answer the question. If the context doesn't contain relevant information, say so.\n\n${result.context}`
            );
          }
        } catch (err) {
          console.error("RAG query failed:", err);
        }
      }

      // Prepend combined system message
      if (systemParts.length > 0) {
        const systemMsg: Message = {
          role: "system",
          content: systemParts.join("\n\n---\n\n"),
        };
        messagesForLLM = [systemMsg, ...allMessages];
      }

      // Add placeholder for streaming response
      const assistantMessage: Message = { role: "assistant", content: "" };
      addMessage(sessionId, assistantMessage);
      setStreaming(true);

      try {
        let fullContent = "";
        for await (const chunk of streamChat(messagesForLLM, model, {
          temperature,
          top_p: topP,
        })) {
          fullContent += chunk;
          updateLastAssistantMessage(sessionId, fullContent);
        }
      } catch (err) {
        console.error("Chat stream error:", err);
        updateLastAssistantMessage(
          sessionId,
          "Error: Failed to get response. Is Ollama running?"
        );
      } finally {
        setStreaming(false);
      }
    },
    [
      activeSessionId,
      activeSession,
      model,
      ragEnabled,
      collection,
      temperature,
      topP,
      topK,
      systemPrompt,
      createSession,
      addMessage,
      updateLastAssistantMessage,
      setRagSources,
      setStreaming,
    ]
  );

  return { activeSession, streaming, ragSources, sendMessage };
}
