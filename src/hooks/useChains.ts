"use client";

import { useState, useEffect, useCallback } from "react";
import { Chain } from "@/lib/types";

const STORAGE_KEY = "harness-chains";

export function useChains() {
  const [chains, setChains] = useState<Chain[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setChains(JSON.parse(stored));
    }
  }, []);

  const persist = (next: Chain[]) => {
    setChains(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const saveChain = useCallback(
    (chain: Chain) => {
      setChains((prev) => {
        const idx = prev.findIndex((c) => c.id === chain.id);
        const next = idx >= 0 ? prev.map((c) => (c.id === chain.id ? chain : c)) : [...prev, chain];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const deleteChain = useCallback(
    (id: string) => {
      setChains((prev) => {
        const next = prev.filter((c) => c.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const getChain = useCallback(
    (id: string): Chain | null => {
      return chains.find((c) => c.id === id) ?? null;
    },
    [chains]
  );

  const exportChain = useCallback(
    (id: string): string => {
      const chain = chains.find((c) => c.id === id);
      if (!chain) return "";
      return JSON.stringify(
        {
          version: 1,
          type: "harness-chain",
          chain: { name: chain.name, description: chain.description, steps: chain.steps },
        },
        null,
        2
      );
    },
    [chains]
  );

  const importChain = useCallback(
    (json: string): Chain | null => {
      try {
        const data = JSON.parse(json);
        if (data.type !== "harness-chain" || !data.chain) return null;
        const chain: Chain = {
          id: crypto.randomUUID(),
          name: data.chain.name,
          description: data.chain.description || "",
          steps: data.chain.steps.map((s: any, i: number) => ({ ...s, stepIndex: i })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setChains((prev) => {
          const next = [...prev, chain];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
        return chain;
      } catch {
        return null;
      }
    },
    []
  );

  return { chains, saveChain, deleteChain, getChain, exportChain, importChain };
}
