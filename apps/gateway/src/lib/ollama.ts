const OLLAMA_URL = process.env.OLLAMA_SERVICE_URL || "http://localhost:11434";

export const ollamaUrl = (path: string) => `${OLLAMA_URL}${path}`;

const RAG_URL = process.env.RAG_SERVICE_URL || "http://localhost:8006";

export const ragUrl = (path: string) => `${RAG_URL}${path}`;
