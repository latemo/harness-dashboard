"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Square,
  Terminal,
  Rocket,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  ExternalLink,
  X,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getPromptExample } from "@/lib/prompt-examples";
import { loadServerState, saveServerState, deleteServerState } from "@/lib/server-state";

interface Props {
  projectPath: string;
  agentCount: number;
  harnessNumber: string;
  onOpenClaude: (dangerousMode: boolean) => void;
}

type Status = "idle" | "running" | "complete" | "error";

interface LogEntry {
  type: "status" | "init" | "tool_use" | "tool_result" | "assistant_text" | "result" | "stdout" | "stderr" | "error" | "timeout" | "complete" | "separator";
  data: string;
  tool?: string;
  detail?: string;
  success?: boolean;
  durationSec?: string;
  turns?: number;
  costUsd?: string;
}

interface PromptHistoryEntry {
  prompt: string;
  timestamp: number;
  costUsd?: string;
  durationSec?: string;
  continued?: boolean;
  resultText?: string; // Claude 최종 답변
}

export default function ExecutionPanel({ projectPath, agentCount, harnessNumber, onOpenClaude }: Props) {
  const storageKey = `harness-prompt-${harnessNumber}`;
  const historyKey = `harness-history-${harnessNumber}`;
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [reconnected, setReconnected] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [promptHistory, setPromptHistory] = useState<PromptHistoryEntry[]>([]);
  // 현재 실행 추적 (채팅 말풍선용)
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const [currentResultText, setCurrentResultText] = useState("");
  const [currentCostUsd, setCurrentCostUsd] = useState("");
  const [currentDurationSec, setCurrentDurationSec] = useState("");

  // 서버에서 프롬프트 및 히스토리 로드
  useEffect(() => {
    loadServerState<string>(storageKey, "").then((saved) => {
      if (saved) setPrompt(saved);
    });
    loadServerState<PromptHistoryEntry[]>(historyKey, []).then((saved) => {
      if (saved.length > 0) {
        // 로드 시 timestamp 기준 중복 제거 (가장 최근 항목 유지)
        const seen = new Set<number>();
        const deduped = [...saved].reverse().filter((h) => {
          if (seen.has(h.timestamp)) return false;
          seen.add(h.timestamp);
          return true;
        }).reverse();
        setPromptHistory(deduped);
        // 중복이 있었으면 정제된 버전으로 서버도 업데이트
        if (deduped.length !== saved.length) {
          saveServerState(historyKey, deduped);
        }
      }
    });
  }, [storageKey, historyKey]);
  const [preview, setPreview] = useState<{
    detected: boolean;
    type?: string;
    label?: string;
    url?: string;
    status?: "starting" | "running" | "error";
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const historyAddedRef = useRef(false);

  // 프롬프트 변경 시 서버에 저장 (비어있으면 저장 안 함 — 삭제는 실행 성공 시 명시적으로 처리)
  useEffect(() => {
    if (prompt) saveServerState(storageKey, prompt);
  }, [prompt, storageKey]);

  // 히스토리 변경 시 서버에 저장
  useEffect(() => {
    if (promptHistory.length > 0) saveServerState(historyKey, promptHistory);
  }, [promptHistory, historyKey]);

  // 미리보기 감지 함수
  const detectPreview = useCallback(() => {
    if (!projectPath) return;
    fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath, action: "detect" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.detected) {
          setPreview({ detected: true, type: data.type, label: data.label, url: data.url, status: data.running ? "running" : undefined });
        } else {
          setPreview(null);
        }
      })
      .catch(() => {});
  }, [projectPath]);

  // 프로젝트 경로 변경 또는 실행 완료 시 미리보기 감지
  useEffect(() => {
    if (status === "idle" || status === "complete") {
      detectPreview();
    }
  }, [status, projectPath, detectPreview]);

  const handlePreview = async () => {
    setPreview((p) => p ? { ...p, status: "starting" } : p);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath, action: "start" }),
      });
      const data = await res.json();
      if (data.error) {
        setPreview((p) => p ? { ...p, status: "error" } : p);
        return;
      }
      setPreview((p) => p ? { ...p, url: data.url, status: data.status } : p);

      // 서버 시작 폴링
      if (data.status === "starting") {
        const poll = setInterval(async () => {
          const r = await fetch("/api/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectPath, action: "status" }),
          });
          const s = await r.json();
          if (s.running) {
            setPreview((p) => p ? { ...p, status: "running" } : p);
            setPreviewOpen(true);
            clearInterval(poll);
          } else if (!s.starting) {
            clearInterval(poll);
          }
        }, 3000);
        // 5분 후 폴링 중지 (Flutter 빌드 등 긴 작업 허용)
        setTimeout(() => clearInterval(poll), 300000);
      } else if (data.status === "running") {
        setPreviewOpen(true);
      }
    } catch {
      setPreview((p) => p ? { ...p, status: "error" } : p);
    }
  };

  const handleStopPreview = async () => {
    await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath, action: "stop" }),
    });
    setPreview((p) => p ? { ...p, status: undefined, url: undefined } : p);
    setPreviewOpen(false);
  };

  // 자동 스크롤
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // 경과 시간 타이머
  useEffect(() => {
    if (status === "running") {
      if (!reconnected) setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, reconnected]);

  // ── 마운트 시 실행 중인 프로세스 복구 ──
  useEffect(() => {
    let cancelled = false;

    async function checkRunningProcess() {
      try {
        const res = await fetch("/api/execute-claude", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectPath, action: "status" }),
        });
        const data = await res.json();

        if (cancelled) return;

        if (data.running) {
          // 실행 중인 프로세스 발견 → 로그 복구 + 스트리밍 재연결
          setLogs(data.logs || []);
          setStatus("running");
          setReconnected(true);
          reconnectStream();
        } else if (data.logs?.length > 0) {
          // 이미 완료된 프로세스의 로그가 남아있음
          setLogs(data.logs);
          setStatus(data.status === "error" ? "error" : "complete");
        }
      } catch {
        // 서버 연결 실패 시 무시
      }
    }

    async function reconnectStream() {
      abortRef.current = new AbortController();
      try {
        // 기존 프로세스에 스트리밍 재연결 (prompt 없이 보내면 기존 프로세스에 연결)
        const res = await fetch("/api/execute-claude", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectPath, prompt: "__reconnect__" }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (cancelled) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const entry = JSON.parse(line) as LogEntry;
              // 재연결 시 기존 로그와 중복 방지: 전체를 서버 로그로 교체
              setLogs((prev) => {
                // 이미 같은 data를 가진 마지막 로그가 있으면 스킵
                if (prev.length > 0 && prev[prev.length - 1].data === entry.data && prev[prev.length - 1].type === entry.type) {
                  return prev;
                }
                return [...prev, entry];
              });

              if (entry.type === "result") {
                setStatus(entry.success ? "complete" : "error");
                if (entry.success) setTimeout(detectPreview, 500);
              } else if (entry.type === "complete") {
                setStatus((prev) => (prev === "running" ? "complete" : prev));
                setTimeout(detectPreview, 500);
              } else if (entry.type === "timeout") {
                setStatus("complete"); // 타임아웃이지만 부분 결과물 있음
                setTimeout(detectPreview, 500);
              } else if (entry.type === "error") {
                setStatus("error");
              }
            } catch {
              // ignore
            }
          }
        }

        if (!cancelled) {
          setStatus((prev) => {
            if (prev === "running") {
              setTimeout(detectPreview, 500);
              return "complete";
            }
            return prev;
          });
        }
      } catch {
        // abort or network error
      }
    }

    checkRunningProcess();

    return () => {
      cancelled = true;
    };
  }, [projectPath]);

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
  };

  const handleExecute = useCallback(async (continueSession = false) => {
    if (!prompt.trim() || status === "running") return;

    const isContinue = continueSession && hasSession;

    // 이전 로그 클리어
    try {
      await fetch("/api/execute-claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath, action: "clear" }),
      });
    } catch {
      // ignore
    }

    // 히스토리 항목 준비
    const ts = Date.now();
    const historyEntry: PromptHistoryEntry = {
      prompt: prompt.trim(),
      timestamp: ts,
      continued: isContinue,
    };
    historyAddedRef.current = false;

    // 채팅 말풍선용 현재 실행 정보 초기화
    setSubmittedPrompt(prompt.trim());
    setCurrentTimestamp(ts);
    setCurrentResultText("");
    setCurrentCostUsd("");
    setCurrentDurationSec("");

    setStatus("running");
    setLogs([]);
    setExpandedIdx(null);
    setReconnected(false);
    abortRef.current = new AbortController();

    // 첫 번째 로그 도착 시 구분선 삽입 여부 플래그
    let firstLog = true;

    try {
      const res = await fetch("/api/execute-claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath, prompt, continueSession: isContinue }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        setStatus("error");
        setLogs([{ type: "error", data: `API 응답 오류 (${res.status})` }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const entry = JSON.parse(line) as LogEntry;
            if (firstLog) {
              firstLog = false;
              // 이전 로그가 있으면 구분선 삽입 후 새 로그, 없으면 바로 추가
              setLogs((prev) =>
                prev.length > 0
                  ? [...prev, { type: "separator", data: new Date().toLocaleTimeString("ko-KR") }, entry]
                  : [entry]
              );
            } else {
              setLogs((prev) => [...prev, entry]);
            }

            if (entry.type === "result") {
              setStatus(entry.success ? "complete" : "error");
              setHasSession(true);
              // 채팅 말풍선용 결과 저장
              setCurrentResultText(entry.data || "");
              setCurrentCostUsd(entry.costUsd || "");
              setCurrentDurationSec(entry.durationSec || "");
              if (entry.success) {
                setPrompt("");
                deleteServerState(storageKey); // 서버에서도 즉시 삭제
                setTimeout(detectPreview, 500);
              }
              // 중복 방지: 한 번만 히스토리에 추가
              if (!historyAddedRef.current) {
                historyAddedRef.current = true;
                historyEntry.costUsd = entry.costUsd;
                historyEntry.durationSec = entry.durationSec;
                historyEntry.resultText = entry.data; // Claude 답변 저장
                setPromptHistory((prev) => {
                  const deduped = prev.filter((h) => h.timestamp !== historyEntry.timestamp);
                  return [...deduped, historyEntry].slice(-20);
                });
                // 히스토리에 추가됐으므로 현재 실행 말풍선 제거 (중복 방지)
                setSubmittedPrompt("");
              }
            } else if (entry.type === "complete") {
              setStatus((prev) => (prev === "running" ? "complete" : prev));
              setHasSession(true);
              setPrompt("");
              deleteServerState(storageKey);
              setSubmittedPrompt("");
              setTimeout(detectPreview, 500);
            } else if (entry.type === "error") {
              setStatus("error");
              // 에러 시에는 프롬프트 유지 (재시도 편의)
            } else if (entry.type === "timeout") {
              setStatus("complete");
              setHasSession(true);
              setPrompt("");
              deleteServerState(storageKey);
              setSubmittedPrompt("");
              setTimeout(detectPreview, 500);
            }
          } catch {
            setLogs((prev) => [...prev, { type: "stdout", data: line }]);
          }
        }
      }

      setStatus((prev) => {
        if (prev === "running") {
          setHasSession(true);
          setPrompt("");
          deleteServerState(storageKey);
          setSubmittedPrompt("");
          setTimeout(detectPreview, 500);
          return "complete";
        }
        return prev;
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setLogs((prev) => [...prev, { type: "status", data: "실행이 중지되었습니다." }]);
        setStatus("idle");
      } else {
        setLogs((prev) => [...prev, { type: "error", data: String(err) }]);
        setStatus("error");
      }
    }
  }, [prompt, projectPath, status, hasSession, detectPreview]);

  const handleStop = async () => {
    abortRef.current?.abort();
    try {
      await fetch("/api/execute-claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath, action: "stop" }),
      });
    } catch {
      // 무시
    }
    setStatus("idle");
  };

  const handleClearLogs = async () => {
    try {
      await fetch("/api/execute-claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath, action: "clear" }),
      });
    } catch {
      // ignore
    }
    setLogs([]);
    setStatus("idle");
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardContent className="p-0 flex flex-col">
          {/* 헤더 */}
          <div className="px-5 pt-5 pb-3 flex items-center gap-2 border-b border-border/30">
            <Play className="h-4 w-4" />
            <h3 className="text-sm font-semibold">웹에서 바로 실행</h3>
          </div>

          {/* ── 채팅 타임라인 ── */}
          <div
            className="flex-1 space-y-4 overflow-y-auto px-5 py-4 min-h-[80px]"
            style={{ maxHeight: "600px" }}
            ref={logRef}
          >
            {promptHistory.length === 0 && !submittedPrompt && (
              <p className="text-xs text-muted-foreground text-center py-4">
                아래 입력창에 프롬프트를 입력하고 실행하세요.
              </p>
            )}
            {/* 과거 대화 */}
            {promptHistory.map((entry) => (
              <ChatTurn
                key={entry.timestamp}
                userMessage={entry.prompt}
                claudeMessage={entry.resultText}
                timestamp={entry.timestamp}
                costUsd={entry.costUsd}
                durationSec={entry.durationSec}
                continued={entry.continued}
                logs={[]}
              />
            ))}
            {/* 현재 실행 */}
            {submittedPrompt && (
              <ChatTurn
                userMessage={submittedPrompt}
                claudeMessage={status === "complete" || status === "error" ? currentResultText : undefined}
                timestamp={currentTimestamp}
                costUsd={currentCostUsd}
                durationSec={currentDurationSec}
                continued={false}
                logs={logs}
                isLive={status === "running"}
                elapsed={elapsed}
                reconnected={reconnected}
                agentCount={agentCount}
                isError={status === "error"}
              />
            )}
          </div>

          {/* ── 프롬프트 입력 (하단 고정) ── */}
          <div className="px-5 pb-5 pt-3 border-t border-border/30 space-y-2">
            <div className="flex gap-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleExecute(hasSession);
                  }
                }}
                placeholder={hasSession ? "이전 작업을 이어서 수정할 내용을 입력하세요..." : getPromptExample(harnessNumber)}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] max-h-[160px]"
                rows={2}
                disabled={status === "running"}
              />
              <div className="flex flex-col gap-1 self-end">
                {status === "running" ? (
                  <Button onClick={handleStop} variant="destructive" className="shrink-0 gap-2">
                    <Square className="h-4 w-4" />
                    중지
                  </Button>
                ) : hasSession ? (
                  <>
                    <Button
                      onClick={() => handleExecute(true)}
                      disabled={!prompt.trim()}
                      className="shrink-0 gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      이어서 실행
                    </Button>
                    <Button
                      onClick={() => handleExecute(false)}
                      disabled={!prompt.trim()}
                      variant="outline"
                      className="shrink-0 gap-1 text-xs"
                      size="sm"
                    >
                      <Rocket className="h-3 w-3" />
                      새로 실행
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => handleExecute(false)}
                    disabled={!prompt.trim()}
                    className="shrink-0 gap-2"
                  >
                    <Rocket className="h-4 w-4" />
                    실행
                  </Button>
                )}
              </div>
            </div>
            {hasSession && status !== "running" && (
              <div className="flex items-center gap-2 text-xs text-blue-400">
                <RotateCcw className="h-3 w-3" />
                <span>이전 세션이 유지됩니다. 수정 사항을 입력하면 이어서 작업합니다.</span>
              </div>
            )}
          </div>

          {/* 미리보기 버튼 (카드 내 하단) */}
          <div className="px-5 pb-5 space-y-3">
          {status !== "running" && preview?.detected && (
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Eye className="h-4 w-4 text-purple-400" />
                  <span className="text-purple-300">
                    {preview.label} 프로젝트 감지됨
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {preview.status === "running" && preview.url && (
                    <>
                      <a
                        href={preview.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        새 탭
                      </a>
                      <button
                        onClick={() => setPreviewOpen(!previewOpen)}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
                      >
                        <Eye className="h-3 w-3" />
                        {previewOpen ? "닫기" : "미리보기"}
                      </button>
                      <button
                        onClick={handleStopPreview}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                      >
                        <X className="h-3 w-3" />
                        중지
                      </button>
                    </>
                  )}
                  {preview.status === "starting" && (
                    <span className="flex items-center gap-1 text-xs text-purple-300">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      환경 구성 중...
                    </span>
                  )}
                  {(!preview.status || preview.status === "error") && (
                    <button
                      onClick={handlePreview}
                      className="flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 transition-colors"
                    >
                      <Play className="h-3 w-3" />
                      실행하여 미리보기
                    </button>
                  )}
                </div>
              </div>
              {preview.status === "error" && (
                <div className="mt-2 text-xs text-red-400">환경 구성에 실패했습니다. 수동으로 실행해주세요.</div>
              )}
            </div>
          )}

          {/* 미리보기 iframe */}
          {previewOpen && preview?.url && preview.status === "running" && (
            <div className="rounded-lg border border-purple-500/30 overflow-hidden">
              <div className="flex items-center justify-between bg-purple-500/10 px-3 py-1.5 text-xs text-purple-300">
                <span>{preview.url}</span>
                <button onClick={() => setPreviewOpen(false)} className="hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <iframe
                src={preview.url}
                className="w-full bg-white"
                style={{ height: "600px" }}
                title="Preview"
              />
            </div>
          )}

          {/* 터미널 열기 버튼 */}
          <div className="border-t border-border/30 pt-3 mt-1">
            <p className="text-xs text-muted-foreground mb-2">또는 터미널에서 직접 실행</p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => onOpenClaude(false)} variant="outline" className="gap-2">
                <Terminal className="h-4 w-4" />
                일반 모드
              </Button>
              <Button onClick={() => onOpenClaude(true)} variant="outline" className="gap-2">
                <Rocket className="h-4 w-4" />
                바이패스 모드
              </Button>
            </div>
          </div>

        </div>{/* /미리보기+터미널 버튼 */}
        </CardContent>
      </Card>
    </div>
  );
}

function LogLine({ entry, expanded, onToggle }: { entry: LogEntry; expanded: boolean; onToggle: () => void }) {
  switch (entry.type) {
    case "separator":
      return (
        <div className="flex items-center gap-2 py-2 my-1">
          <div className="flex-1 border-t border-white/10" />
          <span className="text-[10px] text-gray-600 shrink-0">{entry.data}</span>
          <div className="flex-1 border-t border-white/10" />
        </div>
      );

    case "status":
    case "init":
      return <div className="text-blue-400 py-0.5">{entry.data}</div>;

    case "tool_use":
      return (
        <div className="py-0.5">
          <button
            onClick={onToggle}
            className="flex items-center gap-1 text-yellow-400 hover:text-yellow-300 transition-colors w-full text-left"
          >
            {entry.detail ? (
              expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />
            ) : (
              <span className="w-3" />
            )}
            <span className="truncate">{entry.data}</span>
          </button>
          {expanded && entry.detail && (
            <div className="ml-4 mt-1 p-2 rounded bg-white/5 text-gray-400 whitespace-pre-wrap break-all text-[11px] max-h-[200px] overflow-y-auto">
              {entry.detail}
            </div>
          )}
        </div>
      );

    case "tool_result":
      return <div className="text-gray-500 py-0.5 text-[11px]">{entry.data}</div>;

    case "assistant_text":
      return (
        <div className="text-gray-200 py-1 whitespace-pre-wrap border-l-2 border-green-500/40 pl-2 my-1">
          {entry.data}
        </div>
      );

    case "result":
      if (!entry.data) return null;
      return <ResultEntry data={entry.data} />;

    case "stderr":
    case "error":
      return <div className="text-red-400 py-0.5">{entry.data}</div>;

    case "complete":
      return <div className="text-blue-400 py-0.5">{entry.data}</div>;

    case "stdout":
    default:
      return <div className="text-gray-300 py-0.5">{entry.data}</div>;
  }
}

function ClaudeResponse({ text }: { text: string }) {
  const PREVIEW = 600;
  const [expanded, setExpanded] = useState(text.length <= PREVIEW);
  return (
    <div className="text-sm text-green-100/90 whitespace-pre-wrap leading-relaxed">
      {expanded ? text : text.slice(0, PREVIEW) + "…"}
      {text.length > PREVIEW && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-2 text-xs text-green-500 hover:text-green-300 underline"
        >
          {expanded ? "접기" : `더 보기 (${text.length}자)`}
        </button>
      )}
    </div>
  );
}

function ResultEntry({ data }: { data: string }) {
  const [expanded, setExpanded] = useState(data.length <= 800);
  const preview = data.slice(0, 800);
  return (
    <div className="text-green-400 py-1 mt-2 border-t border-white/10 pt-2 whitespace-pre-wrap">
      {expanded ? data : preview + (data.length > 800 ? "…" : "")}
      {data.length > 800 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 block text-xs text-green-600 hover:text-green-400 underline"
        >
          {expanded ? "접기" : `더 보기 (${data.length}자)`}
        </button>
      )}
    </div>
  );
}

interface ChatTurnProps {
  userMessage: string;
  claudeMessage?: string;
  timestamp: number;
  costUsd?: string;
  durationSec?: string;
  continued?: boolean;
  logs: LogEntry[];
  isLive?: boolean;
  elapsed?: number;
  reconnected?: boolean;
  agentCount?: number;
  isError?: boolean;
}

function ChatTurn({
  userMessage,
  claudeMessage,
  timestamp,
  costUsd,
  durationSec,
  continued,
  logs,
  isLive,
  elapsed = 0,
  reconnected,
  agentCount,
  isError,
}: ChatTurnProps) {
  const [showLogs, setShowLogs] = useState(false);
  const [expandedLogIdx, setExpandedLogIdx] = useState<number | null>(null);

  const toolLogs = logs.filter((l) =>
    ["tool_use", "tool_result", "assistant_text", "status", "init", "stderr", "error", "stdout"].includes(l.type)
  );
  const lastToolLog = [...logs].reverse().find((l) => l.type === "tool_use");

  const formatDur = (sec: string | undefined) => {
    if (!sec) return "";
    const n = Number(sec);
    return n >= 60 ? `${Math.floor(n / 60)}분 ${Math.round(n % 60)}초` : `${sec}초`;
  };

  return (
    <div className="space-y-2">
      {/* 사용자 말풍선 (우측) */}
      <div className="flex justify-end items-end gap-2">
        <span className="text-[10px] text-muted-foreground shrink-0">
          {new Date(timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-blue-600/20 border border-blue-500/30 px-3 py-2 text-sm text-blue-100">
          {continued && <span className="text-blue-400 text-xs mr-1">↩ 이어서</span>}
          <span className="whitespace-pre-wrap break-words">{userMessage}</span>
        </div>
      </div>

      {/* Claude 말풍선 (좌측) */}
      <div className="flex gap-2">
        <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white/5 border border-white/10 px-3 py-2 text-sm space-y-2">
          {/* 실행 중 인디케이터 */}
          {isLive && (
            <div className="flex items-center gap-2 text-blue-400 text-xs">
              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
              <span className="truncate">
                {reconnected && "재연결됨 · "}
                {lastToolLog ? lastToolLog.data : agentCount ? `${agentCount}명의 에이전트 팀이 작업 중...` : "작업 중..."}
              </span>
              {elapsed > 0 && <span className="text-muted-foreground shrink-0">{elapsed}초</span>}
            </div>
          )}

          {/* 에러 상태 */}
          {isError && !claudeMessage && (
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle className="h-3 w-3 shrink-0" />
              실행 중 오류가 발생했습니다
            </div>
          )}

          {/* Claude 답변 */}
          {claudeMessage && <ClaudeResponse text={claudeMessage} />}

          {/* 대기 중 플레이스홀더 (실행 중이고 아직 도구 사용도 없을 때) */}
          {isLive && !lastToolLog && !claudeMessage && (
            <div className="text-muted-foreground text-xs">응답을 기다리는 중...</div>
          )}

          {/* 이전 기록 (응답 미저장) */}
          {!isLive && !isError && !claudeMessage && (durationSec || costUsd) && (
            <div className="text-muted-foreground/50 text-xs italic">응답이 저장되지 않은 기록입니다</div>
          )}

          {/* 메타 정보 + 로그 토글 */}
          {(durationSec || costUsd || toolLogs.length > 0) && (
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t border-white/10">
              {durationSec && <span>{formatDur(durationSec)}</span>}
              {costUsd && <span>${costUsd}</span>}
              {toolLogs.length > 0 && (
                <button
                  onClick={() => setShowLogs((v) => !v)}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <Terminal className="h-3 w-3" />
                  {showLogs ? "로그 닫기" : `상세 로그 (${toolLogs.length})`}
                </button>
              )}
            </div>
          )}

          {/* 상세 로그 패널 */}
          {showLogs && toolLogs.length > 0 && (
            <div className="rounded bg-[#0d1117] p-2 font-mono text-[11px] max-h-[300px] overflow-y-auto space-y-0.5 border border-white/10">
              {toolLogs.map((log, i) => (
                <LogLine
                  key={i}
                  entry={log}
                  expanded={expandedLogIdx === i}
                  onToggle={() => setExpandedLogIdx(expandedLogIdx === i ? null : i)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
