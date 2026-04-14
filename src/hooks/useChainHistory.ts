"use client";

import { useState, useEffect, useCallback } from "react";
import { ChainHistoryEntry } from "@/lib/types";

const STORAGE_KEY = "harness-chain-history";

export function useChainHistory() {
  const [history, setHistory] = useState<ChainHistoryEntry[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setHistory(JSON.parse(stored));
    }
  }, []);

  const addEntry = useCallback((entry: ChainHistoryEntry) => {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 30);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { history, addEntry, clearHistory };
}
