// LLM provider configuration

const OLLAMA_URL = process.env.OLLAMA_SERVICE_URL || "http://localhost:11434";
const RAG_URL = process.env.RAG_SERVICE_URL || "http://localhost:8006";

export const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
export const GROQ_URL = "https://api.groq.com/openai/v1";
export const LLM_PROVIDER = process.env.LLM_PROVIDER || "ollama";

export const ollamaUrl = (path: string) => `${OLLAMA_URL}${path}`;
export const ragUrl = (path: string) => `${RAG_URL}${path}`;
export const groqUrl = (path: string) => `${GROQ_URL}${path}`;

// Groq models available on the free tier
export const GROQ_MODELS = [
  { name: "groq/llama-3.3-70b-versatile", size: 70e9, family: "llama" },
  { name: "groq/llama-3.1-8b-instant", size: 8e9, family: "llama" },
  { name: "groq/gemma2-9b-it", size: 9e9, family: "gemma" },
  { name: "groq/mixtral-8x7b-32768", size: 47e9, family: "mixtral" },
];

export function resolveProvider(requestProvider?: string): string {
  return requestProvider || LLM_PROVIDER;
}

/** Strip the "groq/" prefix to get the actual Groq model ID */
export function groqModelId(model: string): string {
  return model.startsWith("groq/") ? model.slice(5) : model;
}
