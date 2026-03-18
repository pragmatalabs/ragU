export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

export interface RagSource {
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  chunk_index: number;
}

export interface RagResult {
  context: string;
  sources: RagSource[];
  question: string;
  collection: string;
}

export interface Collection {
  name: string;
  chunk_count: number;
  doc_count: number;
}

export interface IngestResult {
  job_id: string;
  filename: string;
  collection: string;
  minio_key: string;
  status: string;
}

export interface JobStatus {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  filename: string;
  collection: string;
  minio_key: string;
  chunks: number;
  error: string | null;
}

export interface StoredFile {
  key: string;
  size: number;
  modified: string | null;
}

export interface AgentConfigItem {
  id: string;
  name: string;
  content: string;
  enabled: boolean;
}
