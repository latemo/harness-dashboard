"use client";

import { useState, useCallback } from "react";
import { Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chain, ChainStep, HarnessSummary } from "@/lib/types";
import ChainStepCard from "./ChainStepCard";
import HarnessPickerDialog from "./HarnessPickerDialog";

interface Props {
  harnesses: HarnessSummary[];
  initialChain?: Chain;
  outputsMap: Record<string, string[]>; // harnessId → output file list
  onSave: (chain: Chain) => void;
  onCancel: () => void;
}

export default function ChainBuilder({ harnesses, initialChain, outputsMap, onSave, onCancel }: Props) {
  const [name, setName] = useState(initialChain?.name || "");
  const [description, setDescription] = useState(initialChain?.description || "");
  const [steps, setSteps] = useState<ChainStep[]>(initialChain?.steps || []);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleAddHarness = useCallback(
    (harness: HarnessSummary) => {
      setSteps((prev) => [
        ...prev,
        {
          stepIndex: prev.length,
          harnessId: harness.id,
          harnessTitle: harness.title,
          harnessNumber: harness.number,
          outputsToForward: [],
        },
      ]);
    },
    []
  );

  const handleRemoveStep = useCallback((index: number) => {
    setSteps((prev) =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepIndex: i }))
    );
  }, []);

  const handleOutputToggle = useCallback((stepIndex: number, filename: string) => {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.stepIndex !== stepIndex) return s;
        const has = s.outputsToForward.includes(filename);
        return {
          ...s,
          outputsToForward: has
            ? s.outputsToForward.filter((f) => f !== filename)
            : [...s.outputsToForward, filename],
        };
      })
    );
  }, []);

  const handleSave = () => {
    if (!name.trim() || steps.length < 2) return;
    const now = new Date().toISOString();
    const chain: Chain = {
      id: initialChain?.id || crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      steps,
      createdAt: initialChain?.createdAt || now,
      updatedAt: now,
    };
    onSave(chain);
  };

  return (
    <div className="space-y-6">
      {/* 이름 / 설명 */}
      <div className="space-y-3">
        <Input
          placeholder="체인 이름 (예: 비즈니스 런칭 파이프라인)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-base"
        />
        <Input
          placeholder="설명 (선택사항)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* 스텝 목록 */}
      <div className="space-y-0">
        {steps.map((step, i) => {
          const harness = harnesses.find((h) => h.id === step.harnessId);
          return (
            <ChainStepCard
              key={`${step.harnessId}-${i}`}
              step={step}
              category={harness?.category}
              availableOutputs={outputsMap[step.harnessId] || []}
              onOutputToggle={(file) => handleOutputToggle(i, file)}
              onRemove={() => handleRemoveStep(i)}
              index={i}
              isLast={i === steps.length - 1}
            />
          );
        })}
      </div>

      {/* 하네스 추가 버튼 */}
      <button
        onClick={() => setPickerOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/50 py-4 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
      >
        <Plus className="h-4 w-4" />
        하네스 추가
      </button>

      {/* 액션 버튼 */}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} className="gap-1.5">
          <X className="h-4 w-4" />
          취소
        </Button>
        <Button
          onClick={handleSave}
          disabled={!name.trim() || steps.length < 2}
          className="gap-1.5"
        >
          <Save className="h-4 w-4" />
          저장
        </Button>
      </div>

      {/* 하네스 선택 다이얼로그 */}
      <HarnessPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleAddHarness}
        harnesses={harnesses}
      />
    </div>
  );
}
