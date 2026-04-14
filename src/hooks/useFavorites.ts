"use client";

import { useState, useEffect, useCallback } from "react";
import { loadServerState, saveServerState } from "@/lib/server-state";

const STORAGE_KEY = "harness-favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    loadServerState<string[]>(STORAGE_KEY, []).then((data) => {
      setFavorites(data);
    });
  }, []);

  const toggle = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      saveServerState(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  return { favorites, toggle, isFavorite };
}
