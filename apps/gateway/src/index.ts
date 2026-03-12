import { Hono } from "hono";
import { cors } from "hono/cors";
import { chatRoutes } from "./routes/chat";
import { modelsRoutes } from "./routes/models";
import { documentsRoutes } from "./routes/documents";
import { ragRoutes } from "./routes/rag";

const app = new Hono();

app.use("/*", cors());

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/api/chat", chatRoutes);
app.route("/api/models", modelsRoutes);
app.route("/api/documents", documentsRoutes);
app.route("/api/rag", ragRoutes);

const port = Number(process.env.PORT) || 3006;
console.log(`Gateway running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
