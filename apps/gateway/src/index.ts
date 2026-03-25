import { Hono } from "hono";
import { cors } from "hono/cors";
import { chatRoutes } from "./routes/chat";
import { modelsRoutes } from "./routes/models";
import { documentsRoutes } from "./routes/documents";
import { ragRoutes } from "./routes/rag";
import { authRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";
import { requireAdmin } from "./middleware/auth";

const app = new Hono();

app.use("/*", cors({ origin: (origin) => origin || "*", credentials: true }));

app.get("/health", (c) => c.json({ status: "ok" }));

// Public routes
app.route("/api/auth", authRoutes);
app.route("/api/chat", chatRoutes);
app.route("/api/models", modelsRoutes);
app.route("/api/rag", ragRoutes);

// Documents: read is public, write/delete requires admin
app.route("/api/documents", documentsRoutes);

// Admin-only routes
app.use("/api/admin/*", requireAdmin());
app.route("/api/admin", adminRoutes);

const port = Number(process.env.PORT) || 3006;
console.log(`Gateway running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
