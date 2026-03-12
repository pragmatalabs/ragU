import { Hono } from "hono";
import { ragUrl } from "../lib/ollama";

export const ragRoutes = new Hono();

ragRoutes.post("/query", async (c) => {
  try {
    const body = await c.req.json();

    const resp = await fetch(ragUrl("/query"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return c.json({ error: "RAG query failed", details: err }, 502);
    }

    return c.json(await resp.json());
  } catch (err) {
    console.error("RAG query error:", err);
    return c.json({ error: "RAG query failed", details: String(err) }, 500);
  }
});

ragRoutes.get("/collections", async (c) => {
  try {
    const resp = await fetch(ragUrl("/collections"));
    if (!resp.ok) return c.json({ error: "Failed to list collections" }, 502);
    return c.json(await resp.json());
  } catch (err) {
    console.error("Collections error:", err);
    return c.json([], 200); // Return empty array on failure
  }
});

ragRoutes.delete("/collections/:name", async (c) => {
  try {
    const name = c.req.param("name");
    const resp = await fetch(ragUrl(`/collections/${name}`), { method: "DELETE" });
    if (!resp.ok) return c.json({ error: "Failed to delete collection" }, 502);
    return c.json(await resp.json());
  } catch (err) {
    console.error("Delete collection error:", err);
    return c.json({ error: "Failed to delete collection", details: String(err) }, 500);
  }
});
