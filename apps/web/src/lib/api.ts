import type {
  OllamaModel,
  Message,
  RagResult,
  Collection,
  IngestResult,
  JobStatus,
  StoredFile,
} from "./types";

const API = "/api";

export async function fetchModels(): Promise<OllamaModel[]> {
  const resp = await fetch(`${API}/models`);
  const data = await resp.json();
  return data.models || [];
}

export async function pullModel(name: string): Promise<void> {
  await fetch(`${API}/models/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function* streamChat(
  messages: Message[],
  model: string,
  options?: { temperature?: number; top_p?: number; num_predict?: number; num_ctx?: number; provider?: string; collection?: string }
): AsyncGenerator<string> {
  const resp = await fetch(`${API}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, model, ...options }),
  });

  if (!resp.ok || !resp.body) throw new Error("Chat request failed");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });

    // Ollama returns newline-delimited JSON
    for (const line of text.split("\n").filter(Boolean)) {
      try {
        const json = JSON.parse(line);
        if (json.message?.content) {
          yield json.message.content;
        }
      } catch {
        // partial JSON, skip
      }
    }
  }
}

export async function ragQuery(
  question: string,
  collection: string = "default",
  topK: number = 5
): Promise<RagResult> {
  const resp = await fetch(`${API}/rag/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, collection, top_k: topK }),
  });
  return resp.json();
}

export async function uploadDocument(
  file: File,
  collection: string = "default"
): Promise<IngestResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("collection", collection);
  const resp = await fetch(`${API}/documents/upload`, {
    method: "POST",
    body: form,
  });
  return resp.json();
}

export async function fetchCollections(): Promise<Collection[]> {
  const resp = await fetch(`${API}/rag/collections`);
  return resp.json();
}

export async function deleteCollection(name: string): Promise<void> {
  await fetch(`${API}/rag/collections/${name}`, { method: "DELETE" });
}

export async function checkJobStatus(jobId: string): Promise<JobStatus> {
  const resp = await fetch(`${API}/documents/status/${jobId}`);
  if (!resp.ok) {
    // Job not found (e.g. server restarted, in-memory jobs cleared)
    return {
      job_id: jobId,
      status: "failed",
      filename: "",
      collection: "",
      minio_key: "",
      chunks: 0,
      error: "Job not found (server may have restarted)",
    };
  }
  return resp.json();
}

export async function fetchDocuments(
  collection: string = ""
): Promise<StoredFile[]> {
  const resp = await fetch(
    `${API}/documents?collection=${encodeURIComponent(collection)}`
  );
  return resp.json();
}

export async function voteResponse(data: {
  question: string;
  answer: string;
  collection?: string;
  model?: string;
  provider?: string;
  vote: 1 | -1;
}): Promise<void> {
  await fetch(`${API}/chat/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteFile(key: string): Promise<void> {
  await fetch(`${API}/documents/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
}
