import { useCallback } from "react";
import { useChatStore } from "../stores/chatStore";
import { useSettingsStore } from "../stores/settingsStore";
import { streamChat, ragQuery } from "../lib/api";
import type { Message, AgentConfigItem } from "../lib/types";

function compileAgentPrompt(
  instructions: AgentConfigItem[],
  skills: AgentConfigItem[],
  guardrails: AgentConfigItem[],
  tools: AgentConfigItem[]
): string {
  const parts: string[] = [];

  const enabledInstructions = instructions.filter(
    (i) => i.enabled && i.content.trim()
  );
  if (enabledInstructions.length > 0) {
    parts.push(enabledInstructions.map((i) => i.content.trim()).join("\n\n"));
  }

  const enabledSkills = skills.filter((s) => s.enabled && s.content.trim());
  if (enabledSkills.length > 0) {
    parts.push(
      "## Skills\n" +
        enabledSkills
          .map((s) => `- **${s.name}**: ${s.content.trim()}`)
          .join("\n")
    );
  }

  const enabledGuardrails = guardrails.filter(
    (g) => g.enabled && g.content.trim()
  );
  if (enabledGuardrails.length > 0) {
    parts.push(
      "## Guardrails\n" +
        enabledGuardrails.map((g) => `- ${g.content.trim()}`).join("\n")
    );
  }

  const enabledTools = tools.filter((t) => t.enabled && t.content.trim());
  if (enabledTools.length > 0) {
    parts.push(
      "## Available Tools\n" +
        enabledTools
          .map((t) => `- **${t.name}**: ${t.content.trim()}`)
          .join("\n")
    );
  }

  return parts.join("\n\n---\n\n");
}

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

  const {
    provider,
    model,
    ragEnabled,
    collection,
    temperature,
    topP,
    topK,
    numPredict,
    numCtx,
    instructions,
    skills,
    guardrails,
    tools,
  } = useSettingsStore();

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const sendMessage = useCallback(
    async (content: string) => {
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = createSession();
      }

      const userMessage: Message = { role: "user", content };
      addMessage(sessionId, userMessage);

      const allMessages = [...(activeSession?.messages ?? []), userMessage];

      // Build system prompt from structured agent configs
      let messagesForLLM = allMessages;
      const systemParts: string[] = [];

      // Compile agent config (instructions, skills, guardrails, tools)
      const agentPrompt = compileAgentPrompt(
        instructions,
        skills,
        guardrails,
        tools
      );
      if (agentPrompt) {
        systemParts.push(agentPrompt);
      }

      // RAG context
      if (ragEnabled) {
        try {
          const result = await ragQuery(content, collection, topK);
          setRagSources(result.sources);

          if (result.context) {
            systemParts.push(
              `## Reference Documents\n\n${result.context}\n\n---\nAnswer ONLY based on the documents above. Do not use outside knowledge. If the answer is not in the documents, say so.`
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
          num_predict: numPredict,
          num_ctx: numCtx,
          provider,
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
      provider,
      model,
      ragEnabled,
      collection,
      temperature,
      topP,
      topK,
      numPredict,
      numCtx,
      instructions,
      skills,
      guardrails,
      tools,
      createSession,
      addMessage,
      updateLastAssistantMessage,
      setRagSources,
      setStreaming,
    ]
  );

  return { activeSession, streaming, ragSources, sendMessage };
}
