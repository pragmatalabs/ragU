import { Hono } from "hono";
import {
  getInteractions,
  getInteractionStats,
  checkDbHealth,
} from "../lib/db";
import { ollamaUrl } from "../lib/providers";

export const adminRoutes = new Hono();

// Service health check — ping all backends
adminRoutes.get("/health", async (c) => {
  const services: { name: string; status: string; latencyMs?: number }[] = [];

  const check = async (name: string, fn: () => Promise<boolean>) => {
    const start = Date.now();
    try {
      const ok = await fn();
      services.push({
        name,
        status: ok ? "healthy" : "unhealthy",
        latencyMs: Date.now() - start,
      });
    } catch {
      services.push({
        name,
        status: "unhealthy",
        latencyMs: Date.now() - start,
      });
    }
  };

  await Promise.all([
    check("PostgreSQL", checkDbHealth),
    check("Qdrant", async () => {
      const url = process.env.QDRANT_URL || "http://localhost:6339";
      const r = await fetch(`${url}/readyz`, { signal: AbortSignal.timeout(3000) });
      return r.ok;
    }),
    check("MinIO", async () => {
      const url = process.env.MINIO_URL || "http://localhost:9008";
      const r = await fetch(`${url}/minio/health/live`, { signal: AbortSignal.timeout(3000) });
      return r.ok;
    }),
    check("Redis", async () => {
      const url = process.env.REDIS_URL || "redis://localhost:6379";
      // Simple TCP check — try to connect
      const host = new URL(url.replace("redis://", "http://")).hostname;
      const port = parseInt(new URL(url.replace("redis://", "http://")).port || "6379");
      const socket = await Bun.connect({
        hostname: host,
        port,
        socket: {
          data() {},
          open(socket) { socket.end("PING\r\n"); },
          error() {},
        },
      });
      socket.end();
      return true;
    }),
    check("Ollama", async () => {
      const r = await fetch(ollamaUrl("/"), { signal: AbortSignal.timeout(3000) });
      return r.ok;
    }),
  ]);

  return c.json({ services });
});

// Interaction log — paginated
adminRoutes.get("/interactions", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "25"), 100);
  const search = c.req.query("search") || undefined;

  const result = await getInteractions(page, limit, search);
  return c.json({ ...result, page, limit });
});

// Interaction stats
adminRoutes.get("/interactions/stats", async (c) => {
  const stats = await getInteractionStats();
  return c.json(stats);
});
