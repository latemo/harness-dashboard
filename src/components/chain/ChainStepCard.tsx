"use client";

import { X, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChainStep } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";

interface Props {
  step: ChainStep;
  category?: string;
  availableOutputs: string[];
  onOutputToggle: (filename: string) => void;
  onRemove: () => void;
  index: number;
  isLast: boolean;
}

export default function ChainStepCard({
  step,
  category,
  availableOutputs,
  onOutputToggle,
  onRemove,
  index,
  isLast,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORIES.find((c) => c.id === category);
  const forwardAll = step.outputsToForward.length === 0;

  return (
    <div>
      <div className="rounded-lg border border-border/50 bg-card p-4">
        <div className="flex items-center gap-3">
          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />

          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
            {index + 1}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">
                #{String(step.harnessNumber).padStart(2, "0")}
              </span>
              <span className="text-sm font-medium truncate">{step.harnessTitle}</span>
              {cat && (
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cat.color}`}>
                  {cat.icon}
                </Badge>
              )}
            </div>
          </div>

          {!isLast && availableOutputs.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              넘길 파일
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}

          <button
            onClick={onRemove}
            className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 파일 선택 확장 영역 */}
        {expanded && !isLast && availableOutputs.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5">
            <p className="text-xs text-muted-foreground mb-2">
              다음 단계로 넘길 파일 선택 (미선택 시 전체 전달):
            </p>
            {availableOutputs.map((file) => (
              <label
                key={file}
                className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={forwardAll || step.outputsToForward.includes(file)}
                  onChange={() => onOutputToggle(file)}
                  className="accent-blue-500 h-3.5 w-3.5"
                />
                {file}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 연결선 */}
      {!isLast && (
        <div className="flex justify-center py-1">
          <div className="w-px h-6 bg-border/50 relative">
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-transparent border-t-border/50" />
          </div>
        </div>
      )}
    </div>
  );
}
