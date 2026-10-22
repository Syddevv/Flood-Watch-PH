"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OperationsSnapshot } from "@/lib/admin-operations-data";

export function useAdminOperations() {
  const [data, setData] = useState<OperationsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const id = ++requestId.current;
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/operations", { cache: "no-store", signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load operations.");
      if (id === requestId.current && !signal?.aborted) setData(body.data as OperationsSnapshot);
    } catch (cause) {
      if (id === requestId.current && !signal?.aborted) setError(cause instanceof Error ? cause.message : "Unable to load operations.");
    } finally {
      if (id === requestId.current && !signal?.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Fetch starts an external request; state updates finish after the network boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh(controller.signal);
    const timer = window.setInterval(() => void refresh(controller.signal), 60_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [refresh]);

  return { data, loading, refreshing, error, refresh };
}
