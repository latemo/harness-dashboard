"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Square, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Chain, ChainExecution, ChainStepExecution } from "@/lib/types";
import { useSettings } from "@/hooks/useSettings";
import { useChainHistory } from "@/hooks/useChainHistory";
import ChainPipelineView from "./ChainPipelineView";

interface LogLine {
  type: "stdout" | "stderr" | "status" | "error" | "complete";
  data: string;
}

interface Props {
  chain: Chain;
}

export default function ChainExecutor({ chain }: Props) {
  const { settings } = useSettings();
  const { addEntry } = useChainHistory();
  const [projectPath, setProjectPath] = useState("");
  const [execution, setExecution] = useState<ChainExecution | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [viewingStep, setViewingStep] = useState(0);
  const [stepLogs, setStepLogs] = useState<Map<number, LogLine[]>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const currentLogs = stepLogs.get(viewingStep) || [];

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentLogs.length]);

  const appendLog = useCallback((stepIndex: number, log: LogLine) => {
    setStepLogs((prev) => {
      const next = new Map(prev);
      const logs = [...(next.get(stepIndex) || []), log];
      next.set(stepIndex, logs);
      return next;
    });
  }, []);

  const executeStep = useCallback(
    async (stepIndex: number, contextFiles: { name: string; content: string }[]) => {
      const step = chain.steps[stepIndex];

      // 1. Apply harness
      appendLog(stepIndex, { type: "status", data: `하네스 적용 중: ${step.harnessTitle}...` });
      await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          harnessId: step.harnessId,
          repoPath: settings.repoPath,
          language: settings.language,
          projectPath,
        }),
      });

      // 2. Archive previous workspace files
      if (stepIndex > 0) {
        await fetch("/api/chain/archive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectPath, stepIndex: stepIndex - 1 }),
        });
      }

      // 3. Build prompt with context
      let prompt = `이 프로젝트의 하네스를 실행해주세요.`;
      if (contextFiles.length > 0) {
        prompt =
          `## 이전 단계 산출물 (참고 자료)\n\n` +
          contextFiles.map((f) => `### ${f.name}\n\n${f.content}`).join("\n\n---\n\n") +
          `\n\n---\n\n위 내용을 참고하여 이 프로젝트의 하네스를 실행해주세요.`;
      }

      // 4. Execute claude
      appendLog(stepIndex, { type: "status", data: "Claude Code 실행 중..." });

      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch("/api/execute-claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath, prompt }),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("스트림 없음");

      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n").filter(Boolean);
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line) as LogLine;
              appendLog(stepIndex, parsed);
            } catch {
              // skip
            }
          }
        }
      }

      // 5. Collect outputs
      const wsRes = await fetch(`/api/workspace?projectPath=${encodeURIComponent(projectPath)}`);
      const wsData = await wsRes.json();
      return (wsData.files || []).map((f: { name: string }) => f.name) as string[];
    },
    [chain.steps, projectPath, settings, appendLog]
  );

  const startChain = async () => {
    if (!projectPath || !settings.repoPath) return;

    setIsRunning(true);
    setStepLogs(new Map());
    setCurrentStepIndex(0);
    setViewingStep(0);

    const initSteps: ChainStepExecution[] = chain.steps.map((s) => ({
      stepIndex: s.stepIndex,
      harnessId: s.harnessId,
      harnessTitle: s.harnessTitle,
      status: "pending",
    }));

    const exec: ChainExecution = {
      chainId: chain.id,
      chainName: chain.name,
      projectPath,
      steps: initSteps,
      status: "running",
      startedAt: new Date().toISOString(),
    };
    setExecution(exec);

    let contextFiles: { name: string; content: string }[] = [];
    let hasError = false;

    for (let i = 0; i < chain.steps.length; i++) {
      setCurrentStepIndex(i);
      setViewingStep(i);

      // Update step status to running
      setExecution((prev) => {
        if (!prev) return prev;
        const steps = [...prev.steps];
        steps[i] = { ...steps[i], status: "running", startedAt: new Date().toISOString() };
        return { ...prev, steps };
      });

      try {
        const outputFiles = await executeStep(i, contextFiles);

        // Update step status to complete
        setExecution((prev) => {
          if (!prev) return prev;
          const steps = [...prev.steps];
          steps[i] = { ...steps[i], status: "complete", completedAt: new Date().toISOString(), outputFiles };
          return { ...prev, steps };
        });

        // Collect context for next step
        if (i < chain.steps.length - 1) {
          const step = chain.steps[i];
          const filesToForward = step.outputsToForward.length > 0 ? step.outputsToForward : outputFiles;

          contextFiles = [];
          for (const file of filesToForward) {
            try {
              const fRes = await fetch(
                `/api/workspace?projectPath=${encodeURIComponent(projectPath)}&file=${encodeURIComponent(file)}`
              );
              const fData = await fRes.json();
              if (fData.content) {
                contextFiles.push({ name: file, content: fData.content });
              }
            } catch {
              // skip
            }
          }
        }
      } catch (err) {
        hasError = true;
        setExecution((prev) => {
          if (!prev) return prev;
          const steps = [...prev.steps];
          steps[i] = { ...steps[i], status: "error", error: String(err) };
          return { ...prev, steps, status: "error" };
        });
        appendLog(i, { type: "error", data: `오류: ${String(err)}` });
        break;
      }
    }

    if (!hasError) {
      setExecution((prev) =>
        prev ? { ...prev, status: "complete", completedAt: new Date().toISOString() } : prev
      );
    }

    // Save to history
    addEntry({
      chainId: chain.id,
      chainName: chain.name,
      projectPath,
      stepCount: chain.steps.length,
      executedAt: new Date().toISOString(),
      status: hasError ? "error" : "complete",
    });

    setIsRunning(false);
  };

  const stopChain = () => {
    abortRef.current?.abort();
    setIsRunning(false);
    setExecution((prev) => (prev ? { ...prev, status: "error" } : prev));
  };

  return (
    <div className="space-y-4">
      {/* 프로젝트 경로 + 실행 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <FolderOpen className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="프로젝트 경로 (예: C:/AI/my-project)"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            className="pl-10"
            disabled={isRunning}
          />
        </div>
        {isRunning ? (
          <Button variant="destructive" onClick={stopChain} className="gap-1.5 shrink-0">
            <Square className="h-4 w-4" />
            중지
          </Button>
        ) : (
          <Button
            onClick={startChain}
            disabled={!projectPath || !settings.repoPath}
            className="gap-1.5 shrink-0"
          >
            <Play className="h-4 w-4" />
            실행
          </Button>
        )}
      </div>

      {/* 파이프라인 시각화 */}
      {execution && (
        <ChainPipelineView
          steps={execution.steps}
          currentStepIndex={viewingStep}
          onStepClick={setViewingStep}
        />
      )}

      {/* 로그 뷰어 */}
      {execution && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">
                Step {viewingStep + 1}: {chain.steps[viewingStep]?.harnessTitle}
              </h4>
              {execution.steps[viewingStep] && (
                <span
                  className={`text-xs font-medium ${
                    execution.steps[viewingStep].status === "complete"
                      ? "text-green-400"
                      : execution.steps[viewingStep].status === "running"
                        ? "text-blue-400"
                        : execution.steps[viewingStep].status === "error"
                          ? "text-red-400"
                          : "text-muted-foreground"
                  }`}
                >
                  {execution.steps[viewingStep].status === "complete"
                    ? "완료"
                    : execution.steps[viewingStep].status === "running"
                      ? "실행 중..."
                      : execution.steps[viewingStep].status === "error"
                        ? "오류"
                        : "대기"}
                </span>
              )}
            </div>

            <div className="rounded-lg bg-[#0d1117] border border-border/30 p-3 font-mono text-xs leading-relaxed max-h-[400px] overflow-y-auto">
              {currentLogs.length === 0 ? (
                <span className="text-muted-foreground">로그 대기 중...</span>
              ) : (
                currentLogs.map((log, i) => (
                  <div
                    key={i}
                    className={`${
                      log.type === "stderr" || log.type === "error"
                        ? "text-red-400"
                        : log.type === "status"
                          ? "text-blue-400"
                          : log.type === "complete"
                            ? "text-green-400"
                            : "text-gray-300"
                    }`}
                  >
                    {log.data}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 완료 상태 */}
      {execution?.status === "complete" && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-center">
          <p className="text-sm font-medium text-green-400">
            체인 실행 완료! {chain.steps.length}단계 모두 성공
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            산출물은 {projectPath}/_workspace/ 에서 확인할 수 있습니다.
          </p>
        </div>
      )}

      {execution?.status === "error" && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-center">
          <p className="text-sm font-medium text-red-400">
            체인 실행 중 오류가 발생했습니다
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Step {currentStepIndex + 1}에서 중단됨. 로그를 확인해주세요.
          </p>
        </div>
      )}
    </div>
  );
}
