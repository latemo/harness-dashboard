export interface AgentSummary {
  id: string;
  name: string;
  description: string;
}

export interface AgentDetail extends AgentSummary {
  content: string;
}

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  type: "orchestrator" | "specialized";
}

export interface SkillDetail extends SkillSummary {
  content: string;
}

export type Category =
  | "content-creation"
  | "software-dev"
  | "data-ai"
  | "business-strategy"
  | "education"
  | "legal-compliance"
  | "lifestyle"
  | "communication"
  | "operations"
  | "specialized";

export interface HarnessSummary {
  id: string;
  number: number;
  name: string;
  title: string;
  description: string;
  category: Category;
  categoryLabel: string;
  agentCount: number;
  skillCount: number;
  agentNames: string[];
  skillNames: string[];
}

export interface HarnessDetail extends Omit<HarnessSummary, "agentNames" | "skillNames"> {
  claudeMd: string;
  agents: AgentDetail[];
  skills: SkillDetail[];
  outputs: string[];
}

// ─── Artifact Types ─────────────────────────────────

export type ArtifactType = "pdf" | "code-project" | "slides" | "audio" | "image" | "video-script";

export type PdfTheme = "default" | "academic" | "legal" | "business";

export interface ConvertRequest {
  projectPath: string;
  files: string[];
  type: ArtifactType;
  options?: {
    pdfTheme?: PdfTheme;
    codeLanguage?: string;
    voice?: string;
    imageSize?: string;
  };
}

export interface ConvertResult {
  success: boolean;
  outputFiles: string[];
  error?: string;
}

// ─── Chain Types ─────────────────────────────────────

export interface ChainStep {
  stepIndex: number;
  harnessId: string;
  harnessTitle: string;
  harnessNumber: number;
  outputsToForward: string[]; // 다음 단계로 넘길 파일 (빈 배열 = 전체)
}

export interface Chain {
  id: string;
  name: string;
  description: string;
  steps: ChainStep[];
  createdAt: string;
  updatedAt: string;
}

export type ChainStepStatus = "pending" | "running" | "complete" | "error";

export interface ChainStepExecution {
  stepIndex: number;
  harnessId: string;
  harnessTitle: string;
  status: ChainStepStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  outputFiles?: string[];
}

export interface ChainExecution {
  chainId: string;
  chainName: string;
  projectPath: string;
  steps: ChainStepExecution[];
  status: "idle" | "running" | "complete" | "error";
  startedAt?: string;
  completedAt?: string;
}

export interface ChainHistoryEntry {
  chainId: string;
  chainName: string;
  projectPath: string;
  stepCount: number;
  executedAt: string;
  status: "complete" | "error";
}

export interface ChainTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: Omit<ChainStep, "stepIndex">[];
}
