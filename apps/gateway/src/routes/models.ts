import { Hono } from "hono";
import { ollamaUrl, GROQ_API_KEY, GROQ_MODELS } from "../lib/providers";

export const modelsRoutes = new Hono();

modelsRoutes.get("/", async (c) => {
  // Fetch Ollama models
  let ollamaModels: any[] = [];
  try {
    const resp = await fetch(ollamaUrl("/api/tags"));
    if (resp.ok) {
      const data = await resp.json();
      ollamaModels = data.models || [];
    }
  } catch {
    // Ollama may be unavailable
  }

  // Append Groq models if API key is configured
  const groqModels = GROQ_API_KEY
    ? GROQ_MODELS.map((m) => ({
        name: m.name,
        model: m.name,
        size: m.size,
        details: { family: m.family, parameter_size: `${m.size / 1e9}B` },
        provider: "groq",
      }))
    : [];

  return c.json({ models: [...ollamaModels, ...groqModels] });
});

modelsRoutes.post("/pull", async (c) => {
  const { name } = await c.req.json();
  if (!name) return c.json({ error: "Model name required" }, 400);

  if (name.startsWith("groq/")) {
    return c.json({ status: "ok", message: "Groq models are cloud-hosted" });
  }

  const resp = await fetch(ollamaUrl("/api/pull"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, stream: false }),
  });

  if (!resp.ok) return c.json({ error: "Failed to pull model" }, 502);
  const data = await resp.json();
  return c.json(data);
});
