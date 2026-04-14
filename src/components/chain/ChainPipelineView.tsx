"use client";

import { Loader2, CheckCircle2, AlertCircle, Clock, ArrowRight } from "lucide-react";
import { ChainStepExecution } from "@/lib/types";

interface Props {
  steps: ChainStepExecution[];
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
}

function StatusIcon({ status }: { status: ChainStepExecution["status"] }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
    case "complete":
      return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-400" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function statusColor(status: ChainStepExecution["status"]) {
  switch (status) {
    case "running":
      return "border-blue-500/50 bg-blue-500/5";
    case "complete":
      return "border-green-500/50 bg-green-500/5";
    case "error":
      return "border-red-500/50 bg-red-500/5";
    default:
      return "border-border/30 bg-card";
  }
}

function connectorColor(status: ChainStepExecution["status"]) {
  switch (status) {
    case "complete":
      return "text-green-400";
    case "running":
      return "text-blue-400";
    default:
      return "text-muted-foreground/30";
  }
}

export default function ChainPipelineView({ steps, currentStepIndex, onStepClick }: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onStepClick?.(i)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-all ${statusColor(step.status)} ${
              i === currentStepIndex ? "ring-1 ring-primary/50" : ""
            } hover:bg-accent/50`}
          >
            <StatusIcon status={step.status} />
            <div className="text-left">
              <p className="text-xs font-mono text-muted-foreground">
                #{String(step.harnessTitle ? 0 : i + 1).padStart(2, "0")}
              </p>
              <p className="text-sm font-medium whitespace-nowrap">{step.harnessTitle}</p>
            </div>
          </button>
          {i < steps.length - 1 && (
            <ArrowRight className={`h-4 w-4 shrink-0 ${connectorColor(step.status)}`} />
          )}
        </div>
      ))}
    </div>
  );
}
