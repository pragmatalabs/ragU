import { Hono } from "hono";
import { ollamaUrl } from "../lib/ollama";

export const modelsRoutes = new Hono();

modelsRoutes.get("/", async (c) => {
  const resp = await fetch(ollamaUrl("/api/tags"));
  if (!resp.ok) return c.json({ error: "Failed to list models" }, 502);
  const data = await resp.json();
  return c.json(data);
});

modelsRoutes.post("/pull", async (c) => {
  const { name } = await c.req.json();
  if (!name) return c.json({ error: "Model name required" }, 400);

  const resp = await fetch(ollamaUrl("/api/pull"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, stream: false }),
  });

  if (!resp.ok) return c.json({ error: "Failed to pull model" }, 502);
  const data = await resp.json();
  return c.json(data);
});
