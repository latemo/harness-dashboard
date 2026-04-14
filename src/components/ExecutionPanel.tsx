"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Square,
  Terminal,
  Rocket,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Zap,
  DollarSign,
  RefreshCw,
  Eye,
  ExternalLink,
  X,
  History,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getPromptExample } from "@/lib/prompt-examples";
import { loadServerState, saveServerState } from "@/lib/server-state";

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
  const [hasSession, setHasSession] = useState(false); // 이전 세션 존재 여부
  const [promptHistory, setPromptHistory] = useState<PromptHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // 서버에서 프롬프트 및 히스토리 로드
  useEffect(() => {
    loadServerState<string>(storageKey, "").then((saved) => {
      if (saved) setPrompt(saved);
    });
    loadServerState<PromptHistoryEntry[]>(historyKey, []).then((saved) => {
      if (saved.length > 0) setPromptHistory(saved);
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

  // 프롬프트 변경 시 서버에 저장
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
    const historyEntry: PromptHistoryEntry = {
      prompt: prompt.trim(),
      timestamp: Date.now(),
      continued: isContinue,
    };
    historyAddedRef.current = false;

    setStatus("running");
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
              if (entry.success) {
                setPrompt(""); // 성공 시 입력창 클리어
                setTimeout(detectPreview, 500);
              }
              // 중복 방지: 한 번만 히스토리에 추가
              if (!historyAddedRef.current) {
                historyAddedRef.current = true;
                historyEntry.costUsd = entry.costUsd;
                historyEntry.durationSec = entry.durationSec;
                setPromptHistory((prev) => {
                  const deduped = prev.filter((h) => h.timestamp !== historyEntry.timestamp);
                  return [...deduped, historyEntry].slice(-20);
                });
              }
            } else if (entry.type === "complete") {
              setStatus((prev) => (prev === "running" ? "complete" : prev));
              setHasSession(true);
              setPrompt(""); // complete 시에도 입력창 클리어
              setTimeout(detectPreview, 500);
            } else if (entry.type === "error") {
              setStatus("error");
              // 에러 시에는 프롬프트 유지 (재시도 편의)
            } else if (entry.type === "timeout") {
              setStatus("complete");
              setHasSession(true);
              setPrompt("");
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

  const resultEntry = logs.find((l) => l.type === "result");
  const toolCount = logs.filter((l) => l.type === "tool_use").length;

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Play className="h-4 w-4" />
            웹에서 바로 실행
          </h3>

          {/* 프롬프트 입력 */}
          <div className="space-y-2">
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
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] max-h-[120px]"
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

            {/* 세션 이어하기 안내 */}
            {hasSession && status === "complete" && (
              <div className="flex items-center gap-2 text-xs text-blue-400">
                <RotateCcw className="h-3 w-3" />
                <span>이전 세션이 유지됩니다. 수정 사항을 입력하면 이어서 작업합니다.</span>
              </div>
            )}

            {/* 프롬프트 히스토리 */}
            {promptHistory.length > 0 && (
              <div>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <History className="h-3 w-3" />
                  실행 이력 ({promptHistory.length})
                  {showHistory ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
                {showHistory && (
                  <div className="mt-2 rounded-lg border border-border/50 bg-background/50 max-h-[200px] overflow-y-auto">
                    {[...promptHistory].reverse().map((entry, i) => (
                      <button
                        key={i}
                        onClick={() => setPrompt(entry.prompt)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors border-b border-border/30 last:border-b-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-foreground">
                            {entry.continued && <span className="text-blue-400 mr-1">↩</span>}
                            {entry.prompt}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {entry.costUsd && `$${entry.costUsd}`}
                            {entry.durationSec && ` · ${Number(entry.durationSec) >= 60 ? `${Math.floor(Number(entry.durationSec) / 60)}분` : `${Math.round(Number(entry.durationSec))}초`}`}
                          </span>
                        </div>
                        <div className="text-muted-foreground mt-0.5">
                          {new Date(entry.timestamp).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 실행 중 상태 바 */}
          {status === "running" && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-blue-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {reconnected && "재연결됨 · "}
                    {agentCount}명의 에이전트 팀이 작업 중...
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatElapsed(elapsed)}
                  </span>
                  {toolCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      도구 {toolCount}회
                    </span>
                  )}
                </div>
              </div>
              {logs.length > 0 && (
                <div className="text-xs text-muted-foreground truncate">
                  {logs[logs.length - 1]?.data}
                </div>
              )}
            </div>
          )}

          {/* 완료 상태 */}
          {status === "complete" && resultEntry && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  실행 완료
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {resultEntry.durationSec && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {Number(resultEntry.durationSec) >= 60
                        ? `${Math.floor(Number(resultEntry.durationSec) / 60)}분 ${Math.round(Number(resultEntry.durationSec) % 60)}초`
                        : `${resultEntry.durationSec}초`}
                    </span>
                  )}
                  {resultEntry.turns && (
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {resultEntry.turns}턴
                    </span>
                  )}
                  {resultEntry.costUsd && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ${resultEntry.costUsd}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          {status === "complete" && !resultEntry && (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              실행 완료
            </div>
          )}

          {/* 미리보기 버튼 */}
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

          {/* 에러 상태 */}
          {status === "error" && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4" />
                실행 중 오류 발생
              </div>
            </div>
          )}

          {/* 출력 로그 */}
          {logs.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  로그 ({logs.length}건)
                </span>
                {status !== "running" && (
                  <button
                    onClick={handleClearLogs}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                    로그 초기화
                  </button>
                )}
              </div>
              <div
                ref={logRef}
                className="rounded-lg bg-[#0d1117] border border-border/30 p-3 font-mono text-xs leading-relaxed max-h-[500px] overflow-y-auto space-y-0.5"
              >
                {logs.map((log, i) => (
                  <LogLine
                    key={i}
                    entry={log}
                    expanded={expandedIdx === i}
                    onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 구분선 */}
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">또는 터미널에서 직접 실행</span>
        <Separator className="flex-1" />
      </div>

      {/* 터미널 열기 버튼 */}
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
      return (
        <div className="text-green-400 py-1 mt-2 border-t border-white/10 pt-2 whitespace-pre-wrap">
          {entry.data.length > 500 ? entry.data.slice(0, 500) + "\n...(결과 일부 생략)" : entry.data}
        </div>
      );

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
