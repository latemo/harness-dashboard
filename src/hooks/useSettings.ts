"use client";

import { useState, useEffect, useCallback } from "react";
import { loadServerState, saveServerState } from "@/lib/server-state";

const STORAGE_KEY = "harness-settings";

export interface Settings {
  repoPath: string;
  language: "ko" | "en";
}

const DEFAULT_SETTINGS: Settings = {
  repoPath: "",
  language: "ko",
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadServerState<Settings | null>(STORAGE_KEY, null).then((stored) => {
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...stored });
        return;
      }
      // 최초 접속: 서버에서 실제 경로를 받아와서 기본값으로 설정
      fetch("/api/setup")
        .then((res) => res.json())
        .then((data) => {
          if (data.path) {
            const initial = { ...DEFAULT_SETTINGS, repoPath: data.path };
            setSettings(initial);
            saveServerState(STORAGE_KEY, initial);
          }
        })
        .catch(() => {});
    });
  }, []);

  const update = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveServerState(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const getRepoBase = useCallback(() => {
    const base = settings.repoPath.replace(/[\/\\]$/, "");
    return base ? `${base}/${settings.language}` : "";
  }, [settings]);

  return { settings, update, getRepoBase };
}
