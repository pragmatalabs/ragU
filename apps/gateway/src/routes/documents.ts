import { Hono } from "hono";
import { ragUrl } from "../lib/ollama";

export const documentsRoutes = new Hono();

// Upload file → RAG stores in MinIO + starts async processing
documentsRoutes.post("/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const collection = (formData.get("collection") as string) || "default";

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return c.json({ error: "No file provided" }, 400);
    }

    const bytes = await file.arrayBuffer();
    const blob = new Blob([bytes], { type: file.type || "application/octet-stream" });

    const ragFormData = new FormData();
    ragFormData.append("file", blob, file.name);

    const resp = await fetch(ragUrl(`/ingest?collection=${encodeURIComponent(collection)}`), {
      method: "POST",
      body: ragFormData,
    });

    if (!resp.ok) {
      const err = await resp.text();
      return c.json({ error: "Ingest failed", details: err }, 502);
    }

    return c.json(await resp.json(), 202);
  } catch (err) {
    console.error("Document upload error:", err);
    return c.json({ error: "Upload failed", details: String(err) }, 500);
  }
});

// Check async processing status
documentsRoutes.get("/status/:jobId", async (c) => {
  try {
    const jobId = c.req.param("jobId");
    const resp = await fetch(ragUrl(`/ingest/status/${jobId}`));
    if (!resp.ok) return c.json({ error: "Status check failed" }, 502);
    return c.json(await resp.json());
  } catch (err) {
    return c.json({ error: "Status check failed", details: String(err) }, 500);
  }
});

// Delete a file from MinIO
documentsRoutes.delete("/:key{.+}", async (c) => {
  try {
    const key = c.req.param("key");
    const resp = await fetch(ragUrl(`/files/${key}`), { method: "DELETE" });
    if (!resp.ok) return c.json({ error: "Delete failed" }, 502);
    return c.json(await resp.json());
  } catch (err) {
    return c.json({ error: "Delete failed", details: String(err) }, 500);
  }
});

// List files from MinIO
documentsRoutes.get("/", async (c) => {
  try {
    const collection = c.req.query("collection") || "";
    const resp = await fetch(ragUrl(`/files?collection=${encodeURIComponent(collection)}`));
    if (!resp.ok) return c.json([], 200);
    return c.json(await resp.json());
  } catch {
    return c.json([], 200);
  }
});
