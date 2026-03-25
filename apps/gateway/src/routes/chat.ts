import { Hono } from "hono";
import { stream } from "hono/streaming";
import {
  ollamaUrl,
  GROQ_API_KEY,
  groqUrl,
  resolveProvider,
  groqModelId,
} from "../lib/providers";
import { logInteraction } from "../lib/db";

export const chatRoutes = new Hono();

chatRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const provider = resolveProvider(body.provider);

  // Extract user question for logging
  const messages = body.messages || [];
  const userMsg = [...messages].reverse().find((m: any) => m.role === "user");
  const question = userMsg?.content || "";
  const hasSystem = messages.some((m: any) => m.role === "system" && m.content?.includes("Reference Documents"));

  if (provider === "groq") {
    return handleGroq(c, body, question, hasSystem);
  }
  return handleOllama(c, body, question, hasSystem);
});

// ─── Ollama (local) ──────────────────────────────────────────
async function handleOllama(c: any, body: any, question: string, ragEnabled: boolean) {
  const resp = await fetch(ollamaUrl("/api/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: body.model || "llama3.2:3b",
      messages: body.messages || [],
      stream: true,
      keep_alive: "30m",
      options: {
        temperature: body.temperature ?? 0.7,
        top_p: body.top_p ?? 0.9,
        num_predict: body.num_predict ?? 512,
        num_ctx: body.num_ctx ?? 4096,
      },
    }),
  });

  if (!resp.ok || !resp.body) {
    return c.json({ error: "Ollama request failed" }, 502);
  }

  return stream(c, async (s) => {
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let fullAnswer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      await s.write(text);

      // Capture answer for logging
      for (const line of text.split("\n").filter(Boolean)) {
        try {
          const json = JSON.parse(line);
          if (json.message?.content) fullAnswer += json.message.content;
        } catch {}
      }
    }

    // Fire-and-forget log
    if (question) {
      logInteraction({
        session_id: body.session_id || "unknown",
        question,
        answer: fullAnswer,
        model: body.model || "llama3.2:3b",
        provider: "ollama",
        rag_enabled: ragEnabled,
        collection: body.collection || "default",
        sources_count: body.sources_count || 0,
      });
    }
  });
}

// ─── Groq (cloud, OpenAI-compatible) ─────────────────────────
async function handleGroq(c: any, body: any, question: string, ragEnabled: boolean) {
  if (!GROQ_API_KEY) {
    return c.json({ error: "GROQ_API_KEY not configured" }, 500);
  }

  const model = groqModelId(body.model || "llama-3.3-70b-versatile");

  const resp = await fetch(groqUrl("/chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: body.messages || [],
      stream: true,
      temperature: body.temperature ?? 0.7,
      top_p: body.top_p ?? 0.9,
      max_tokens: body.num_predict ?? 1024,
    }),
  });

  if (!resp.ok || !resp.body) {
    const errText = await resp.text().catch(() => "unknown");
    console.error("Groq error:", resp.status, errText);
    return c.json({ error: "Groq request failed", details: errText }, 502);
  }

  return stream(c, async (s) => {
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullAnswer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          await s.write(JSON.stringify({ done: true }) + "\n");

          // Fire-and-forget log
          if (question) {
            logInteraction({
              session_id: body.session_id || "unknown",
              question,
              answer: fullAnswer,
              model: body.model || "groq/llama-3.3-70b-versatile",
              provider: "groq",
              rag_enabled: ragEnabled,
              collection: body.collection || "default",
              sources_count: body.sources_count || 0,
            });
          }
          return;
        }

        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            fullAnswer += content;
            await s.write(
              JSON.stringify({ message: { content } }) + "\n"
            );
          }
        } catch {}
      }
    }
  });
}
