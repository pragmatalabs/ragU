import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { Send, Paperclip, X, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { uploadDocument, checkJobStatus } from "../lib/api";
import { useSettingsStore } from "../stores/settingsStore";

type FileUploadStatus = "uploading" | "processing" | "completed" | "failed";

interface AttachedFile {
  id: string;
  file: File;
  status: FileUploadStatus;
  chunks?: number;
  error?: string;
}

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

const ACCEPTED_TYPES = ".txt,.md,.pdf,.csv,.json,.docx,.doc,.xls,.xlsx";

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const collection = useSettingsStore((s) => s.collection);

  const updateFile = useCallback(
    (id: string, updates: Partial<AttachedFile>) => {
      setAttachedFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
      );
    },
    []
  );

  const processUpload = useCallback(
    async (file: File) => {
      const fileId = Math.random().toString(36).substring(2, 10);
      const attached: AttachedFile = { id: fileId, file, status: "uploading" };
      setAttachedFiles((prev) => [...prev, attached]);

      try {
        const result = await uploadDocument(file, collection);
        updateFile(fileId, { status: "processing" });

        // Poll for completion
        let polls = 0;
        const maxPolls = 200;
        const pollInterval = 1500;

        const poll = async () => {
          if (polls >= maxPolls) {
            updateFile(fileId, { status: "failed", error: "Timeout" });
            return;
          }
          polls++;
          try {
            const status = await checkJobStatus(result.job_id);
            if (status.status === "completed") {
              updateFile(fileId, {
                status: "completed",
                chunks: status.chunks,
              });
            } else if (status.status === "failed") {
              updateFile(fileId, {
                status: "failed",
                error: status.error || "Processing failed",
              });
            } else {
              updateFile(fileId, {
                status: "processing",
                chunks: status.chunks,
              });
              setTimeout(poll, pollInterval);
            }
          } catch {
            updateFile(fileId, { status: "failed", error: "Poll error" });
          }
        };

        setTimeout(poll, pollInterval);
      } catch (err) {
        updateFile(fileId, {
          status: "failed",
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    },
    [collection, updateFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      Array.from(files).forEach(processUpload);
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [processUpload]
  );

  const removeFile = useCallback((id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
    // Clear completed/failed files after sending
    setAttachedFiles((prev) =>
      prev.filter((f) => f.status !== "completed" && f.status !== "failed")
    );
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        Array.from(files).forEach(processUpload);
      }
    },
    [processUpload]
  );

  const statusIcon = (status: FileUploadStatus) => {
    switch (status) {
      case "uploading":
        return <Loader2 size={14} className="animate-spin text-blue-400" />;
      case "processing":
        return <Loader2 size={14} className="animate-spin text-yellow-400" />;
      case "completed":
        return <CheckCircle2 size={14} className="text-emerald-400" />;
      case "failed":
        return <AlertCircle size={14} className="text-red-400" />;
    }
  };

  const statusLabel = (f: AttachedFile) => {
    switch (f.status) {
      case "uploading":
        return "Uploading...";
      case "processing":
        return f.chunks ? `Processing (${f.chunks} chunks)...` : "Processing...";
      case "completed":
        return f.chunks ? `${f.chunks} chunks indexed` : "Indexed";
      case "failed":
        return f.error || "Failed";
    }
  };

  return (
    <div
      className="border-t border-gray-800 p-4"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="max-w-3xl mx-auto">
        {/* Attached files */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachedFiles.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs"
              >
                <FileText size={14} className="text-gray-400 flex-shrink-0" />
                <span className="text-gray-300 truncate max-w-[120px]">
                  {f.file.name}
                </span>
                {statusIcon(f.status)}
                <span
                  className={`${
                    f.status === "completed"
                      ? "text-emerald-400"
                      : f.status === "failed"
                      ? "text-red-400"
                      : "text-gray-500"
                  }`}
                >
                  {statusLabel(f)}
                </span>
                <button
                  onClick={() => removeFile(f.id)}
                  className="text-gray-500 hover:text-gray-300 ml-1"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex gap-2 items-end">
          {/* File upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
            title="Attach file for RAG ingestion"
          >
            <Paperclip size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder="Send a message... (drag & drop files to upload)"
            rows={1}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 resize-none focus:outline-none focus:border-blue-500 text-sm max-h-40"
            disabled={disabled}
          />
          <button
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            className="p-3 bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
