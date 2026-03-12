import { useState, useEffect, useCallback } from "react";
import { fetchModels, pullModel } from "../lib/api";
import type { OllamaModel } from "../lib/types";

export function useModels() {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const m = await fetchModels();
      setModels(m);
    } catch {
      console.error("Failed to fetch models");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pull = useCallback(
    async (name: string) => {
      setPulling(true);
      try {
        await pullModel(name);
        await refresh();
      } catch {
        console.error("Failed to pull model");
      } finally {
        setPulling(false);
      }
    },
    [refresh]
  );

  return { models, loading, pulling, refresh, pull };
}
