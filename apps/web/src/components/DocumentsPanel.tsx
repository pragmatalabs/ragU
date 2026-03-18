import { useState, useRef, useEffect, useCallback } from "react";
import {
  fetchCollections,
  fetchDocuments,
  deleteCollection,
  deleteFile,
  uploadDocument,
  checkJobStatus,
} from "../lib/api";
import {
  Upload,
  Trash2,
  RefreshCw,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  FolderOpen,
  HardDrive,
  AlertCircle,
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

const MAX_POLLS = 200;

export function DocumentsPanel() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [dragOver, setDragOver] = useState(false);
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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const c = await fetchCollections();
      if (isMounted.current) setCollections(c);

      const f = await fetchDocuments(selectedCollection);
      if (isMounted.current) setFiles(f);
    } catch {
      // service may be down
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [selectedCollection]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll active jobs
  const pollActiveJobs = useCallback(
    async (currentJobs: UploadJob[]) => {
      const active = currentJobs.filter(
        (j) =>
          (j.status === "queued" || j.status === "processing") &&
          j.pollCount < MAX_POLLS
      );

      if (active.length === 0) {
        const updated = currentJobs.map((j) =>
          (j.status === "queued" || j.status === "processing") &&
          j.pollCount >= MAX_POLLS
            ? { ...j, status: "failed" as const, error: "Timed out" }
            : j
        );
        if (isMounted.current) setJobs(updated);
        return;
      }

      const results = await Promise.allSettled(
        active.map(async (job) => {
          const status = await checkJobStatus(job.jobId);
          return { jobId: job.jobId, status };
        })
      );

      if (!isMounted.current) return;

      let anyCompleted = false;

      const updated = currentJobs.map((job) => {
        const result = results.find(
          (r) => r.status === "fulfilled" && r.value.jobId === job.jobId
        );

        if (!result || result.status === "rejected") {
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
        if (anyCompleted) refresh();

        const stillActive = updated.some(
          (j) =>
            (j.status === "queued" || j.status === "processing") &&
            j.pollCount < MAX_POLLS
        );

        if (stillActive) {
          pollTimerRef.current = setTimeout(
            () => pollActiveJobs(updated),
            1500
          );
        }
      }
    },
    [refresh]
  );

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
  }, [jobs, pollActiveJobs]);

  const handleFiles = async (fileList: FileList) => {
    const collection = selectedCollection || "default";
    for (const file of Array.from(fileList)) {
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
      }
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const handleDeleteFile = async (key: string) => {
    await deleteFile(key);
    refresh();
  };

  const handleDeleteCollection = async (name: string) => {
    await deleteCollection(name);
    if (selectedCollection === name) setSelectedCollection("");
    refresh();
  };

  const extractFilename = (key: string) => {
    const parts = key.split("/");
    const last = parts[parts.length - 1];
    // Strip UUID prefix: {uuid}_{filename}
    const underscoreIdx = last.indexOf("_");
    return underscoreIdx > 0 ? last.slice(underscoreIdx + 1) : last;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const totalChunks = collections.reduce((sum, c) => sum + c.chunk_count, 0);
  const totalDocs = files.length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Document Management
            </h2>
            <p className="text-sm text-gray-500">
              {collections.length} collection{collections.length !== 1 && "s"}{" "}
              &middot; {totalDocs} file{totalDocs !== 1 && "s"} &middot;{" "}
              {totalChunks} chunks
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Collection filter */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 uppercase tracking-wider">
            Collection
          </label>
          <select
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All collections</option>
            {collections.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.chunk_count} chunks)
              </option>
            ))}
          </select>
        </div>

        {/* Upload zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragOver
              ? "border-blue-500 bg-blue-500/10"
              : "border-gray-700 hover:border-gray-600"
          }`}
        >
          <Upload
            size={32}
            className={`mx-auto mb-3 ${dragOver ? "text-blue-400" : "text-gray-600"}`}
          />
          <p className="text-sm text-gray-400 mb-1">
            Drag and drop files here, or{" "}
            <button
              onClick={() => fileRef.current?.click()}
              className="text-blue-400 hover:text-blue-300 underline"
            >
              browse
            </button>
          </p>
          <p className="text-xs text-gray-600">
            PDF, DOCX, XLSX, CSV, JSON, TXT, MD
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.pdf,.csv,.json,.docx,.doc,.xls,.xlsx"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
        </div>

        {/* Active upload jobs */}
        {jobs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 uppercase tracking-wider">
                Upload Jobs
              </span>
              {jobs.some(
                (j) => j.status === "completed" || j.status === "failed"
              ) && (
                <button
                  onClick={() =>
                    setJobs((prev) =>
                      prev.filter(
                        (j) =>
                          j.status === "queued" || j.status === "processing"
                      )
                    )
                  }
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  Clear finished
                </button>
              )}
            </div>
            {jobs.map((job, i) => (
              <div
                key={`${job.jobId}-${i}`}
                className="flex items-center gap-3 bg-gray-800/50 border border-gray-800 rounded-lg px-4 py-2.5"
              >
                {job.status === "queued" || job.status === "processing" ? (
                  <Loader2 size={16} className="animate-spin text-blue-400" />
                ) : job.status === "completed" ? (
                  <CheckCircle2 size={16} className="text-emerald-400" />
                ) : (
                  <XCircle size={16} className="text-red-400" />
                )}
                <span className="flex-1 text-sm text-gray-300 truncate">
                  {job.filename}
                </span>
                <span
                  className={`text-xs whitespace-nowrap ${
                    job.status === "completed"
                      ? "text-emerald-400"
                      : job.status === "failed"
                        ? "text-red-400"
                        : "text-blue-400"
                  }`}
                >
                  {job.status === "queued"
                    ? "Queued..."
                    : job.status === "processing"
                      ? `Processing${job.chunks > 0 ? ` (${job.chunks} chunks)` : "..."}`
                      : job.status === "completed"
                        ? `${job.chunks} chunks indexed`
                        : job.error || "Failed"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Collections */}
        {collections.length > 0 && (
          <div className="space-y-3">
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              Collections
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {collections.map((c) => (
                <div
                  key={c.name}
                  className={`bg-gray-800/50 border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedCollection === c.name
                      ? "border-blue-500"
                      : "border-gray-800 hover:border-gray-700"
                  }`}
                  onClick={() =>
                    setSelectedCollection(
                      selectedCollection === c.name ? "" : c.name
                    )
                  }
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <HardDrive size={14} className="text-blue-400" />
                      <span className="text-sm font-medium text-white">
                        {c.name}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCollection(c.name);
                      }}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                      title="Delete collection"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>{c.chunk_count} chunks</span>
                    <span>{c.doc_count} docs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files table */}
        {files.length > 0 ? (
          <div className="space-y-3">
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              Files{selectedCollection ? ` in "${selectedCollection}"` : ""}
            </span>
            <div className="bg-gray-800/30 border border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Filename</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Modified</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr
                      key={f.key}
                      className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText
                            size={14}
                            className="text-gray-500 flex-shrink-0"
                          />
                          <span className="text-gray-300 truncate max-w-xs">
                            {extractFilename(f.key)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {f.size ? formatSize(f.size) : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {f.modified ? formatDate(f.modified) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteFile(f.key)}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                          title="Delete file"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : !loading && collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
            <AlertCircle size={48} strokeWidth={1} />
            <p className="text-lg">No documents yet</p>
            <p className="text-sm">
              Upload files above to start building your knowledge base
            </p>
          </div>
        ) : (
          !loading &&
          files.length === 0 &&
          selectedCollection && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-2">
              <FolderOpen size={36} strokeWidth={1} />
              <p className="text-sm">
                No files in "{selectedCollection}"
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
