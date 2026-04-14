"use client";

import { ArrowRight, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChainTemplate } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";

interface Props {
  template: ChainTemplate;
  onUse: (template: ChainTemplate) => void;
}

export default function ChainTemplateCard({ template, onUse }: Props) {
  const cat = CATEGORIES.find((c) => c.id === template.category);

  return (
    <Card className="border-border/50 hover:border-border hover:shadow-lg transition-all min-w-[280px] shrink-0">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {cat && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cat.color}`}>
                {cat.icon} {cat.label}
              </Badge>
            )}
          </div>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {template.steps.length}단계
          </Badge>
        </div>

        <div>
          <h3 className="text-sm font-semibold">{template.name}</h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-hidden">
          {template.steps.map((step, i) => (
            <span key={step.harnessId} className="flex items-center gap-1 shrink-0">
              <span className="font-mono">#{String(step.harnessNumber).padStart(2, "0")}</span>
              {i < template.steps.length - 1 && <ArrowRight className="h-3 w-3" />}
            </span>
          ))}
        </div>

        <button
          onClick={() => onUse(template)}
          className="w-full flex items-center justify-center gap-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium py-2 hover:bg-primary/20 transition-colors"
        >
          <Zap className="h-3 w-3" />
          이 템플릿 사용
        </button>
      </CardContent>
    </Card>
  );
}
