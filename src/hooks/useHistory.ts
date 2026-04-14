"use client";

import { useState, useEffect, useCallback } from "react";
import { loadServerState, saveServerState } from "@/lib/server-state";

const STATE_KEY = "harness-history";

export interface HistoryEntry {
  harnessId: string;
  harnessTitle: string;
  projectPath: string;
  appliedAt: string;
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadServerState<HistoryEntry[]>(STATE_KEY, []).then((entries) => {
      setHistory(entries);
      setLoaded(true);
    });
  }, []);

  const addEntry = useCallback((entry: Omit<HistoryEntry, "appliedAt">) => {
    setHistory((prev) => {
      const next = [{ ...entry, appliedAt: new Date().toISOString() }, ...prev.filter((h) => h.harnessId !== entry.harnessId)].slice(0, 50);
      saveServerState(STATE_KEY, next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveServerState(STATE_KEY, []);
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

  return { history, loaded, addEntry, clearHistory, getLastPath, appliedIds, getAppliedInfo };
}
