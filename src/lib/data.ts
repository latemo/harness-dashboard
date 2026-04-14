import { HarnessSummary, HarnessDetail } from "./types";
import harnesses from "@/data/harnesses.json";

export function getAllHarnesses(): HarnessSummary[] {
  return harnesses as HarnessSummary[];
}

export function getHarnessDetail(id: string): HarnessDetail | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require(`@/data/harnesses/${id}.json`);
    return data as HarnessDetail;
  } catch {
    return null;
  }
}

export function getAllHarnessIds(): string[] {
  return (harnesses as HarnessSummary[]).map((h) => h.id);
}

export function getHarnessOutputs(id: string): string[] {
  const detail = getHarnessDetail(id);
  return detail?.outputs ?? [];
}

export function getStats() {
  const all = harnesses as HarnessSummary[];
  return {
    totalHarnesses: all.length,
    totalAgents: all.reduce((s, h) => s + h.agentCount, 0),
    totalSkills: all.reduce((s, h) => s + h.skillCount, 0),
    totalFiles: all.reduce((s, h) => s + h.agentCount + h.skillCount, 0) + all.length, // + CLAUDE.md per harness
  };
}
