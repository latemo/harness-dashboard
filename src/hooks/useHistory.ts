"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "harness-history";

export interface HistoryEntry {
  harnessId: string;
  harnessTitle: string;
  projectPath: string;
  appliedAt: string;
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setHistory(JSON.parse(stored));
    }
  }, []);

  const addEntry = useCallback((entry: Omit<HistoryEntry, "appliedAt">) => {
    setHistory((prev) => {
      const next = [{ ...entry, appliedAt: new Date().toISOString() }, ...prev].slice(0, 50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const getLastPath = useCallback(
    (harnessId: string): string | null => {
      const entry = history.find((h) => h.harnessId === harnessId);
      return entry?.projectPath ?? null;
    },
    [history]
  );

  const appliedIds = new Set(history.map((h) => h.harnessId));

  const getAppliedInfo = useCallback(
    (harnessId: string): { path: string; date: string } | null => {
      const entry = history.find((h) => h.harnessId === harnessId);
      if (!entry) return null;
      return { path: entry.projectPath, date: entry.appliedAt };
    },
    [history]
  );

  return { history, addEntry, clearHistory, getLastPath, appliedIds, getAppliedInfo };
}
