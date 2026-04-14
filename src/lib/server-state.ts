/**
 * Server-side state persistence utility.
 * Uses /api/state endpoint with localStorage fallback.
 * This ensures data survives port changes (localStorage is origin-based).
 */

export async function loadServerState<T>(key: string, fallback: T): Promise<T> {
  try {
    const res = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get", key }),
    });
    const data = await res.json();
    if (data.value !== null && data.value !== undefined) {
      return data.value as T;
    }
    // Server has no value — check localStorage for migration
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as T;
        // Migrate to server
        saveServerState(key, parsed).catch(() => {});
        return parsed;
      }
    }
    return fallback;
  } catch {
    // API unavailable — fallback to localStorage
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(key);
        return stored ? (JSON.parse(stored) as T) : fallback;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

export async function saveServerState<T>(key: string, value: T): Promise<void> {
  try {
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set", key, value }),
    });
  } catch {
    // Fallback to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }
}

export async function deleteServerState(key: string): Promise<void> {
  try {
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", key }),
    });
  } catch {
    if (typeof window !== "undefined") {
      localStorage.removeItem(key);
    }
  }
}
