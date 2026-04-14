"use client";

import { useState, useEffect, useCallback } from "react";
import { ChainHistoryEntry } from "@/lib/types";
import { loadServerState, saveServerState, deleteServerState } from "@/lib/server-state";

const STORAGE_KEY = "harness-chain-history";

export function useChainHistory() {
  const [history, setHistory] = useState<ChainHistoryEntry[]>([]);

  useEffect(() => {
    loadServerState<ChainHistoryEntry[]>(STORAGE_KEY, []).then((data) => {
      setHistory(data);
    });
  }, []);

  const addEntry = useCallback((entry: ChainHistoryEntry) => {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 30);
      saveServerState(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    deleteServerState(STORAGE_KEY);
  }, []);

  return { history, addEntry, clearHistory };
}
