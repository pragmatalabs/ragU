import { useEffect, useState } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";

interface InteractionLog {
  id: number;
  session_id: string;
  question: string;
  answer: string;
  model: string;
  provider: string;
  rag_enabled: boolean;
  collection: string;
  sources_count: number;
  created_at: string;
}

export function AdminInteractions() {
  const [items, setItems] = useState<InteractionLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);

    fetch(`/api/admin/interactions?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setTotal(d.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Interaction Log</h2>
        <span className="text-xs text-gray-500">{total} total</span>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions or answers..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm text-gray-300 transition-colors"
        >
          Search
        </button>
      </form>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-sm">No interactions found.</p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => {
            const isExpanded = expanded === item.id;
            return (
              <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : item.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
                >
                  <span className="text-xs text-gray-600 w-32 flex-shrink-0">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                  <span className="text-sm text-white flex-1 truncate">{item.question}</span>
                  <span className="text-xs text-gray-500 flex-shrink-0">{item.model}</span>
                  {item.rag_enabled && (
                    <span className="text-[10px] bg-emerald-900/40 text-emerald-400 px-1.5 py-0.5 rounded">
                      RAG
                    </span>
                  )}
                  {isExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-800 px-4 py-3 space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Question</p>
                      <p className="text-sm text-white whitespace-pre-wrap">{item.question}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Answer</p>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {item.answer}
                      </p>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-600">
                      <span>Provider: {item.provider}</span>
                      <span>Model: {item.model}</span>
                      <span>Collection: {item.collection}</span>
                      {item.sources_count > 0 && <span>Sources: {item.sources_count}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 bg-gray-800 rounded text-xs text-gray-300 disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-xs text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 bg-gray-800 rounded text-xs text-gray-300 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
