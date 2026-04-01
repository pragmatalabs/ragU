import { useState, useRef, useEffect } from "react";
import {
  uploadDocument,
  checkJobStatus,
  fetchCollections,
  fetchDocuments,
  deleteCollection,
} from "../lib/api";
import { useSettingsStore } from "../stores/settingsStore";
import {
  Upload,
  Trash2,
  FolderOpen,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { Collection, StoredFile } from "../lib/types";

type JobStatus = "queued" | "processing" | "completed" | "failed";

type UploadJob = {
  jobId: string;
  filename: string;
  status: JobStatus;
  chunks: number;
  error: string | null;
  pollCount: number;
};

const MAX_POLLS = 200; // Stop polling after ~5 minutes (200 * 1.5s)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function DocumentUpload() {
  const { collection, setCollection } = useSettingsStore();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const refreshCollections = async () => {
    try {
      const c = await fetchCollections();
      if (isMounted.current) setCollections(c);
    } catch {
      // service may be down
    }
  };

  const refreshFiles = async () => {
    try {
      const f = await fetchDocuments(collection);
      if (isMounted.current) setFiles(f);
    } catch {
      // service may be down
    }
  };

  // Poll active jobs — called via setTimeout chain, not setInterval
  const pollActiveJobs = async (currentJobs: UploadJob[]) => {
    const active = currentJobs.filter(
      (j) =>
        (j.status === "queued" || j.status === "processing") &&
        j.pollCount < MAX_POLLS
    );

    if (active.length === 0) {
      // Mark over-limit jobs as failed
      const updated = currentJobs.map((j) =>
        (j.status === "queued" || j.status === "processing") &&
        j.pollCount >= MAX_POLLS
          ? { ...j, status: "failed" as const, error: "Timed out waiting" }
          : j
      );
      if (isMounted.current) setJobs(updated);
      return;
    }

    // Poll each active job
    const results = await Promise.allSettled(
      active.map(async (job) => {
        const status = await checkJobStatus(job.jobId);
        return { jobId: job.jobId, status };
      })
    );

    if (!isMounted.current) return;

    let anyCompleted = false;

    const updated = currentJobs.map((job) => {
      // Find result for this job
      const result = results.find(
        (r) =>
          r.status === "fulfilled" && r.value.jobId === job.jobId
      );

      if (!result || result.status === "rejected") {
        // Increment poll count on failure
        if (job.status === "queued" || job.status === "processing") {
          return { ...job, pollCount: job.pollCount + 1 };
        }
        return job;
      }

      const data = result.value.status;

      if (data.status === "completed" || data.status === "failed") {
        anyCompleted = true;
      }

      return {
        ...job,
        status: data.status,
        chunks: data.chunks,
        error: data.error,
        pollCount: job.pollCount + 1,
      };
    });

    if (isMounted.current) {
      setJobs(updated);

      if (anyCompleted) {
        refreshCollections();
        refreshFiles();
      }

      // Continue polling if there are still active jobs
      const stillActive = updated.some(
        (j) =>
          (j.status === "queued" || j.status === "processing") &&
          j.pollCount < MAX_POLLS
      );

      if (stillActive) {
        pollTimerRef.current = setTimeout(() => pollActiveJobs(updated), 1500);
      }
    }
  };

  // Start polling whenever jobs change and there are active ones
  useEffect(() => {
    const hasActive = jobs.some(
      (j) =>
        (j.status === "queued" || j.status === "processing") &&
        j.pollCount < MAX_POLLS
    );

    if (hasActive && !pollTimerRef.current) {
      pollTimerRef.current = setTimeout(() => pollActiveJobs(jobs), 1500);
    }

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setJobs((prev) => [
        {
          jobId: `size-error-${Date.now()}`,
          filename: file.name,
          status: "failed",
          chunks: 0,
          error: `Exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
          pollCount: MAX_POLLS,
        },
        ...prev,
      ]);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const result = await uploadDocument(file, collection);
      setJobs((prev) => [
        {
          jobId: result.job_id,
          filename: result.filename,
          status: "queued",
          chunks: 0,
          error: null,
          pollCount: 0,
        },
        ...prev,
      ]);
    } catch {
      setJobs((prev) => [
        {
          jobId: `error-${Date.now()}`,
          filename: file.name,
          status: "failed",
          chunks: 0,
          error: "Upload failed",
          pollCount: MAX_POLLS,
        },
        ...prev,
      ]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const statusIcon = (status: JobStatus) => {
    switch (status) {
      case "queued":
      case "processing":
        return <Loader2 size={12} className="animate-spin text-blue-400" />;
      case "completed":
        return <CheckCircle2 size={12} className="text-emerald-400" />;
      case "failed":
        return <XCircle size={12} className="text-red-400" />;
    }
  };

  const statusText = (job: UploadJob) => {
    switch (job.status) {
      case "queued":
        return "Queued...";
      case "processing":
        return `Processing${job.chunks > 0 ? ` (${job.chunks} chunks)` : "..."}`;
      case "completed":
        return `${job.chunks} chunks ingested`;
      case "failed":
        return job.error || "Failed";
    }
  };

  const clearFinished = () => {
    setJobs((prev) =>
      prev.filter((j) => j.status === "queued" || j.status === "processing")
    );
  };

  const hasFinished = jobs.some(
    (j) => j.status === "completed" || j.status === "failed"
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Documents
        </label>
        <button
          onClick={() => {
            refreshCollections();
            refreshFiles();
          }}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <FolderOpen size={14} />
        </button>
      </div>

      <input
        value={collection}
        onChange={(e) => setCollection(e.target.value)}
        placeholder="Collection name"
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
      />

      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,.pdf,.csv,.json,.docx,.doc,.xls,.xlsx"
        onChange={handleUpload}
        className="hidden"
      />

      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-2 bg-gray-800 border border-dashed border-gray-600 rounded-lg px-3 py-2 text-xs hover:border-blue-500 hover:text-blue-400 transition-colors disabled:opacity-40"
      >
        {uploading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Upload size={14} />
        )}
        {uploading ? "Uploading..." : "Upload document"}
      </button>

      {/* Active & recent jobs */}
      {jobs.length > 0 && (
        <div className="space-y-1">
          {hasFinished && (
            <button
              onClick={clearFinished}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              Clear finished
            </button>
          )}
          {jobs.map((job, i) => (
            <div
              key={`${job.jobId}-${i}`}
              className="flex items-center gap-2 bg-gray-800/50 rounded px-2 py-1.5 text-xs"
            >
              {statusIcon(job.status)}
              <span className="truncate flex-1 text-gray-300">
                {job.filename}
              </span>
              <span
                className={`text-[10px] whitespace-nowrap ${
                  job.status === "completed"
                    ? "text-emerald-400"
                    : job.status === "failed"
                      ? "text-red-400"
                      : "text-blue-400"
                }`}
              >
                {statusText(job)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Collections list */}
      {collections.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">
            Collections
          </span>
          {collections.map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1 text-xs"
            >
              <span
                className="cursor-pointer hover:text-blue-400"
                onClick={() => setCollection(c.name)}
              >
                {c.name} ({c.chunk_count} chunks)
              </span>
              <button
                onClick={async () => {
                  await deleteCollection(c.name);
                  await refreshCollections();
                }}
                className="text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Files in current collection */}
      {files.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">
            Files in {collection || "all"}
          </span>
          {files.slice(0, 10).map((f) => (
            <div
              key={f.key}
              className="flex items-center gap-2 bg-gray-800/30 rounded px-2 py-1 text-xs text-gray-400"
            >
              <FileText size={10} />
              <span className="truncate flex-1">
                {f.key.split("/").pop()}
              </span>
              <span className="text-[10px] text-gray-600">
                {f.size ? `${(f.size / 1024).toFixed(1)}KB` : ""}
              </span>
            </div>
          ))}
          {files.length > 10 && (
            <span className="text-[10px] text-gray-600 pl-2">
              +{files.length - 10} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
