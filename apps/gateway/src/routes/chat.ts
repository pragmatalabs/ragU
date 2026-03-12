import { Hono } from "hono";
import { stream } from "hono/streaming";
import { ollamaUrl } from "../lib/ollama";

export const chatRoutes = new Hono();

chatRoutes.post("/", async (c) => {
  const body = await c.req.json();

  const ollamaResp = await fetch(ollamaUrl("/api/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: body.model || "llama3.2:3b",
      messages: body.messages || [],
      stream: true,
      options: {
        temperature: body.temperature ?? 0.7,
        top_p: body.top_p ?? 0.9,
      },
    }),
  });

  if (!ollamaResp.ok || !ollamaResp.body) {
    return c.json({ error: "Ollama request failed" }, 502);
  }

  return stream(c, async (s) => {
    const reader = ollamaResp.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await s.write(decoder.decode(value, { stream: true }));
    }
  });
});
