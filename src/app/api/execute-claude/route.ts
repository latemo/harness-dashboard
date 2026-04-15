import { NextRequest } from "next/server";
import * as fs from "fs";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";

interface RunState {
  proc?: ChildProcessWithoutNullStreams;
  logs: Record<string, unknown>[];
  status: "running" | "complete" | "error";
}

// 프로젝트별 실행 상태 + 로그 보관
const runningStates = new Map<string, RunState>();

export async function POST(req: NextRequest) {
  const { projectPath, prompt, action, continueSession } = await req.json();

  // ── 상태 조회 (새로고침 시 재연결용) ──
  if (action === "status") {
    const state = runningStates.get(projectPath);
    if (!state) {
      return Response.json({ running: false, logs: [] });
    }
    return Response.json({
      running: state.status === "running",
      status: state.status,
      logs: state.logs,
    });
  }

  // ── 중지 요청 ──
  if (action === "stop") {
    const state = runningStates.get(projectPath);
    if (state) {
      if (state.proc) {
        state.proc.kill("SIGTERM");
      }
      state.status = "complete";
      state.logs.push({ type: "status", data: "사용자에 의해 중지됨" });
    }
    return Response.json({ stopped: true });
  }

  // ── 로그 초기화 (새 실행 전 이전 로그 삭제) ──
  if (action === "clear") {
    runningStates.delete(projectPath);
    return Response.json({ cleared: true });
  }

  // ── 실행 요청 ──
  if (!projectPath || !prompt) {
    return Response.json({ error: "projectPath, prompt 필수" }, { status: 400 });
  }

  if (!fs.existsSync(projectPath)) {
    return Response.json({ error: `폴더가 존재하지 않습니다: ${projectPath}` }, { status: 404 });
  }

  // 이미 실행 중이면 기존 로그 스트리밍
  const existing = runningStates.get(projectPath);
  if (existing && existing.status === "running") {
    return streamExistingState(existing);
  }

  // 재연결 요청이지만 실행 중이 아니면 무시
  if (prompt === "__reconnect__") {
    return Response.json({ running: false });
  }

  return executeWithCli(projectPath, prompt, !!continueSession);
}

/**
 * CLI spawn 방식 실행 — 기존 동작
 */
function executeWithCli(projectPath: string, prompt: string, continueSession: boolean): Response {
  const encoder = new TextEncoder();

  const state: RunState = {
    logs: [],
    status: "running",
  };

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: Record<string, unknown>) => {
        state.logs.push(event);
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // controller already closed
        }
      };

      send({ type: "status", data: "Claude Code 실행 중..." });

      const cliArgs = ["-p", "--output-format", "stream-json", "--verbose", "--dangerously-skip-permissions"];
      if (continueSession) {
        cliArgs.push("--continue");
      }

      const proc = spawn(
        "claude",
        cliArgs,
        {
          cwd: projectPath,
          shell: true,
          stdio: ["pipe", "pipe", "pipe"],
          env: {
            ...process.env,
            CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1",
          },
        },
      );

      // 프롬프트를 stdin으로 전달 (shell 인자 이스케이프 문제 방지)
      proc.stdin.write(prompt);
      proc.stdin.end();

      state.proc = proc;
      runningStates.set(projectPath, state);

      let buffer = "";

      proc.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf-8");
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            const parsed = parseClaudeEvent(event);
            if (!parsed) continue;
            if (parsed.type === "__multi__") {
              for (const e of parsed.events as Record<string, unknown>[]) send(e);
            } else {
              send(parsed);
            }
          } catch {
            send({ type: "stdout", data: line });
          }
        }
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf-8").trim();
        if (text && !text.includes("ExperimentalWarning") && !text.includes("--trace-warnings")) {
          send({ type: "stderr", data: text });
        }
      });

      proc.on("close", (code) => {
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer);
            const parsed = parseClaudeEvent(event);
            if (parsed) {
              if (parsed.type === "__multi__") {
                for (const e of parsed.events as Record<string, unknown>[]) send(e);
              } else {
                send(parsed);
              }
            }
          } catch {
            send({ type: "stdout", data: buffer });
          }
        }
        state.status = code === 0 ? "complete" : "error";
        send({ type: "complete", data: `프로세스 종료 (코드: ${code})` });
        try {
          controller.close();
        } catch {
          // already closed
        }

        // 30분 후 로그 자동 정리
        setTimeout(() => {
          const s = runningStates.get(projectPath);
          if (s && s.status !== "running") {
            runningStates.delete(projectPath);
          }
        }, 30 * 60 * 1000);
      });

      proc.on("error", (err) => {
        state.status = "error";
        send({ type: "error", data: err.message });
        try {
          controller.close();
        } catch {
          // already closed
        }
      });

      // 30분 타임아웃
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill("SIGTERM");
          send({ type: "timeout", data: "실행 시간이 30분을 초과하여 자동 종료되었습니다. 산출물은 부분적으로 생성되었을 수 있습니다." });
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }, 30 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}

/**
 * 이미 실행 중인 프로세스의 기존 로그를 스트리밍 + 새 로그 대기
 */
function streamExistingState(state: RunState): Response {
  const encoder = new TextEncoder();
  let logIndex = 0;

  const stream = new ReadableStream({
    start(controller) {
      // 1. 기존 로그 일괄 전송
      for (const log of state.logs) {
        controller.enqueue(encoder.encode(JSON.stringify(log) + "\n"));
      }
      logIndex = state.logs.length;

      // 2. 새 로그 폴링 (200ms 간격)
      const interval = setInterval(() => {
        while (logIndex < state.logs.length) {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(state.logs[logIndex]) + "\n"));
          } catch {
            clearInterval(interval);
            return;
          }
          logIndex++;
        }

        // 실행 완료되면 스트림 종료
        if (state.status !== "running" && logIndex >= state.logs.length) {
          clearInterval(interval);
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }, 200);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}

/**
 * CLI stream-json 이벤트를 프론트엔드용 이벤트로 변환
 */
function parseClaudeEvent(event: Record<string, unknown>): Record<string, unknown> | null {
  const type = event.type as string;

  if (type === "system" && event.subtype === "init") {
    const model = (event.model as string) || "unknown";
    const tools = (event.tools as string[]) || [];
    return {
      type: "init",
      data: `세션 시작 (모델: ${model}, 도구: ${tools.length}개)`,
      model,
      toolCount: tools.length,
    };
  }

  if (type === "assistant") {
    const message = event.message as Record<string, unknown>;
    if (!message?.content) return null;

    const contents = message.content as Array<Record<string, unknown>>;
    const events: Record<string, unknown>[] = [];

    for (const content of contents) {
      if (content.type === "text" && content.text) {
        const text = (content.text as string).trim();
        if (text) events.push({ type: "assistant_text", data: text });
      } else if (content.type === "tool_use") {
        const toolName = content.name as string;
        const input = content.input as Record<string, unknown>;
        events.push({
          type: "tool_use",
          data: summarizeToolUse(toolName, input),
          tool: toolName,
          detail: getToolDetail(toolName, input),
        });
      }
      // thinking은 무시
    }

    // 여러 content가 있으면 첫 번째만 반환 (send는 단일 이벤트만 처리)
    // → 호출부에서 복수 이벤트를 처리할 수 있도록 배열로 반환
    return events.length === 1 ? events[0] : events.length > 1 ? { type: "__multi__", events } : null;
  }

  if (type === "user") {
    const toolResult = event.tool_use_result as Record<string, unknown>;
    if (toolResult) {
      const durationMs = toolResult.durationMs as number;
      const duration = durationMs ? `${(durationMs / 1000).toFixed(1)}초` : "";
      return { type: "tool_result", data: `도구 실행 완료${duration ? ` (${duration})` : ""}`, duration };
    }
    return null;
  }

  if (type === "result") {
    const success = event.subtype === "success";
    const durationMs = (event.duration_ms as number) || 0;
    const numTurns = (event.num_turns as number) || 0;
    const cost = (event.total_cost_usd as number) || 0;
    const resultText = (event.result as string) || "";
    return {
      type: "result",
      data: resultText,
      success,
      durationSec: (durationMs / 1000).toFixed(1),
      turns: numTurns,
      costUsd: cost.toFixed(4),
    };
  }

  return null;
}

function summarizeToolUse(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "Read":
      return `📖 파일 읽기: ${shortenPath(input.file_path as string)}`;
    case "Write":
      return `📝 파일 생성: ${shortenPath(input.file_path as string)}`;
    case "Edit":
      return `✏️ 파일 수정: ${shortenPath(input.file_path as string)}`;
    case "Bash":
      return `💻 명령 실행: ${truncate(input.command as string, 80)}`;
    case "Glob":
      return `🔍 파일 검색: ${input.pattern}`;
    case "Grep":
      return `🔎 내용 검색: ${truncate(input.pattern as string, 60)}`;
    case "Agent":
    case "Task":
      return `🤖 에이전트 실행: ${truncate((input.description as string) || (input.prompt as string), 80)}`;
    case "SendMessage":
      return `💬 메시지 전송: ${truncate(input.to as string, 40)}`;
    case "TodoWrite":
      return "📋 작업 목록 업데이트";
    case "WebSearch":
      return `🌐 웹 검색: ${truncate(input.query as string, 60)}`;
    case "WebFetch":
      return "🌐 웹 페이지 가져오기";
    default:
      return `🔧 ${toolName} 실행`;
  }
}

function getToolDetail(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "Bash":
      return (input.command as string) || "";
    case "Write":
    case "Read":
    case "Edit":
      return (input.file_path as string) || "";
    case "Agent":
    case "Task":
      return (input.prompt as string) || (input.description as string) || "";
    default:
      return "";
  }
}

function shortenPath(filePath: string): string {
  if (!filePath) return "(unknown)";
  const parts = filePath.replace(/\\/g, "/").split("/");
  if (parts.length <= 3) return filePath;
  return `.../${parts.slice(-2).join("/")}`;
}

function truncate(text: string, maxLen: number): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}
