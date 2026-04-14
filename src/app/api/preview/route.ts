import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";

interface PreviewState {
  proc?: ChildProcessWithoutNullStreams;
  port: number;
  type: string;
  url: string;
  status: "starting" | "running" | "error";
  logs: string[];
}

const previews = new Map<string, PreviewState>();
let nextPort = 9100;

/**
 * 프로젝트 유형 감지
 */
function detectProjectType(projectPath: string): {
  type: string;
  root: string;
  label: string;
} | null {
  // 검색 대상 디렉토리 목록: _workspace, src, 프로젝트 루트 순으로 탐색
  const searchDirs: string[] = [];
  const ws = path.join(projectPath, "_workspace");
  const src = path.join(projectPath, "src");
  if (fs.existsSync(ws)) searchDirs.push(ws);
  if (fs.existsSync(src)) searchDirs.push(src);
  searchDirs.push(projectPath);

  function findInDirs(filename: string, depth: number): string | null {
    for (const dir of searchDirs) {
      const found = findFileRecursive(dir, filename, depth);
      if (found) return found;
    }
    return null;
  }

  // Flutter
  const flutterDirs = findInDirs("pubspec.yaml", 3);
  if (flutterDirs) {
    return { type: "flutter", root: path.dirname(flutterDirs), label: "Flutter Web" };
  }

  // Next.js
  const nextConfig = findInDirs("next.config.js", 3) ||
    findInDirs("next.config.ts", 3) ||
    findInDirs("next.config.mjs", 3);
  if (nextConfig) {
    return { type: "nextjs", root: path.dirname(nextConfig), label: "Next.js" };
  }

  // React (package.json with react)
  const pkgJson = findInDirs("package.json", 3);
  if (pkgJson) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf-8"));
      if (pkg.dependencies?.react || pkg.devDependencies?.react) {
        return { type: "react", root: path.dirname(pkgJson), label: "React" };
      }
      // General Node.js
      if (pkg.scripts?.start || pkg.scripts?.dev) {
        return { type: "node", root: path.dirname(pkgJson), label: "Node.js" };
      }
    } catch {}
  }

  // Python Flask/Django
  const pyApp = findInDirs("app.py", 3) ||
    findInDirs("manage.py", 3);
  if (pyApp) {
    const content = fs.readFileSync(pyApp, "utf-8");
    if (content.includes("flask") || content.includes("Flask")) {
      return { type: "flask", root: path.dirname(pyApp), label: "Flask" };
    }
    if (content.includes("django")) {
      return { type: "django", root: path.dirname(pyApp), label: "Django" };
    }
    return { type: "python", root: path.dirname(pyApp), label: "Python" };
  }

  // Static HTML
  const htmlFile = findInDirs("index.html", 3);
  if (htmlFile) {
    return { type: "html", root: path.dirname(htmlFile), label: "HTML" };
  }

  return null;
}

function findFileRecursive(dir: string, filename: string, maxDepth: number): string | null {
  if (maxDepth <= 0 || !fs.existsSync(dir)) return null;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === filename && entry.isFile()) {
        return path.join(dir, entry.name);
      }
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        const found = findFileRecursive(path.join(dir, entry.name), filename, maxDepth - 1);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

function getPort(): number {
  // 사용 중인 포트 확인 후 비어있는 포트 반환
  const usedPorts = new Set([...previews.values()].map((s) => s.port));
  let port = 9100;
  while (usedPorts.has(port)) port++;
  return port;
}

/**
 * 프로젝트 유형별 실행 명령 생성
 */
function getStartCommand(type: string, root: string, port: number): {
  setupCmd?: string;
  cmd: string;
  args: string[];
  env?: Record<string, string>;
} {
  switch (type) {
    case "flutter":
      return {
        setupCmd: "C:/flutter/bin/flutter.bat build web --release --no-tree-shake-icons",
        cmd: "npx",
        args: ["serve", "-l", `tcp://0.0.0.0:${port}`, "-s", "build/web"],
      };
    case "nextjs":
      return {
        setupCmd: "npm install",
        cmd: "npx",
        args: ["next", "dev", "--port", String(port)],
      };
    case "react":
      return {
        setupCmd: "npm install",
        cmd: "npx",
        args: ["react-scripts", "start"],
        env: { PORT: String(port), BROWSER: "none" },
      };
    case "node":
      return {
        setupCmd: "npm install",
        cmd: "npm",
        args: ["run", "dev", "--", "--port", String(port)],
      };
    case "flask":
      return {
        setupCmd: "pip install flask 2>/dev/null",
        cmd: "python",
        args: ["app.py"],
        env: { FLASK_RUN_PORT: String(port) },
      };
    case "python":
      return {
        cmd: "python",
        args: ["app.py"],
      };
    case "html":
      return {
        cmd: "npx",
        args: ["serve", "-l", `tcp://0.0.0.0:${port}`, "-s", "."],
      };
    default:
      return { cmd: "npx", args: ["serve", "-l", `tcp://0.0.0.0:${port}`, "-s", "."] };
  }
}

export async function POST(req: NextRequest) {
  const { projectPath, action } = await req.json();

  // ── 감지 ──
  if (action === "detect") {
    const result = detectProjectType(projectPath);
    if (!result) {
      return NextResponse.json({ detected: false, message: "미리보기 가능한 프로젝트를 찾지 못했습니다." });
    }
    const existing = previews.get(projectPath);
    return NextResponse.json({
      detected: true,
      type: result.type,
      label: result.label,
      root: result.root,
      running: existing?.status === "running",
      url: existing?.url,
    });
  }

  // ── 중지 ──
  if (action === "stop") {
    const state = previews.get(projectPath);
    if (state?.proc) {
      state.proc.kill("SIGTERM");
      previews.delete(projectPath);
    }
    return NextResponse.json({ stopped: true });
  }

  // ── 상태 조회 ──
  if (action === "status") {
    const state = previews.get(projectPath);
    if (!state) return NextResponse.json({ running: false });
    return NextResponse.json({
      running: state.status === "running",
      starting: state.status === "starting",
      error: state.status === "error",
      url: state.url,
      type: state.type,
      logs: state.logs.slice(-30),
    });
  }

  // ── 실행 ──
  if (action === "start") {
    // 이미 실행 중이면 URL 반환
    const existing = previews.get(projectPath);
    if (existing && (existing.status === "running" || existing.status === "starting")) {
      return NextResponse.json({ url: existing.url, status: existing.status, type: existing.type });
    }
    // 이전 에러 상태 정리
    if (existing) {
      existing.proc?.kill("SIGTERM");
      previews.delete(projectPath);
    }

    const detected = detectProjectType(projectPath);
    if (!detected) {
      return NextResponse.json({ error: "미리보기 가능한 프로젝트를 찾지 못했습니다." }, { status: 400 });
    }

    // Windows 경로 정규화 (Turbopack ESM 로더 호환성)
    detected.root = path.resolve(detected.root);

    const port = getPort();
    const { setupCmd, cmd, args, env: extraEnv } = getStartCommand(detected.type, detected.root, port);

    const url = `http://localhost:${port}`;
    const state: PreviewState = {
      proc: undefined,
      port,
      type: detected.type,
      url,
      status: "starting",
      logs: [],
    };
    previews.set(projectPath, state);

    // 비동기로 빌드 + 서버 시작 파이프라인 실행 (API는 즉시 응답)
    (async () => {
      // 의존성 설치 / 빌드 (비동기)
      if (setupCmd) {
        try {
          state.logs.push(`[setup] ${setupCmd}\n`);
          const cp = await import("child_process");
          await new Promise<void>((resolve, reject) => {
            const setupProc = cp.spawn(setupCmd, [], {
              cwd: detected.root,
              shell: true,
              stdio: ["pipe", "pipe", "pipe"],
            });
            setupProc.stdout.on("data", (chunk: Buffer) => {
              state.logs.push(chunk.toString("utf-8"));
              if (state.logs.length > 200) state.logs.shift();
            });
            setupProc.stderr.on("data", (chunk: Buffer) => {
              state.logs.push(chunk.toString("utf-8"));
              if (state.logs.length > 200) state.logs.shift();
            });
            setupProc.on("close", (code) => {
              if (code === 0) resolve();
              else reject(new Error(`setup exited with code ${code}`));
            });
            setupProc.on("error", reject);
            // 5분 타임아웃
            setTimeout(() => {
              setupProc.kill("SIGTERM");
              reject(new Error("setup timeout (5min)"));
            }, 300000);
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          state.logs.push(`[setup error] ${msg}\n`);
          state.status = "error";
          return;
        }
      }

      // 서버 실행
      const proc = spawn(cmd, args, {
        cwd: detected.root,
        shell: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...extraEnv },
      });

      state.proc = proc;

      // 로그 수집 + running 감지
      const onData = (chunk: Buffer) => {
        const text = chunk.toString("utf-8");
        state.logs.push(text);
        if (state.logs.length > 200) state.logs.shift();

        // 서버 시작 감지
        if (
          text.includes("localhost") ||
          text.includes("Local:") ||
          text.includes("Accepting connections") ||
          text.includes("listening") ||
          text.includes("ready") ||
          text.includes("Started") ||
          text.includes("Running on") ||
          text.includes("debug service")
        ) {
          state.status = "running";
        }
      };

      proc.stdout.on("data", onData);
      proc.stderr.on("data", onData);

      proc.on("close", (code) => {
        const s = previews.get(projectPath);
        if (s?.proc === proc) {
          if (s.status !== "running") {
            // 시작 전에 죽었으면 에러 상태로 유지 (5분 후 정리)
            s.status = "error";
            s.logs.push(`\n[process exited with code ${code}]\n`);
            setTimeout(() => {
              const cur = previews.get(projectPath);
              if (cur === s) previews.delete(projectPath);
            }, 300000);
          } else {
            previews.delete(projectPath);
          }
        }
      });

      proc.on("error", (err) => {
        state.status = "error";
        state.logs.push(`\n[process error: ${err.message}]\n`);
      });

      // 10분 타임아웃
      setTimeout(() => {
        const s = previews.get(projectPath);
        if (s?.proc === proc) {
          proc.kill("SIGTERM");
          previews.delete(projectPath);
        }
      }, 10 * 60 * 1000);
    })();

    return NextResponse.json({
      url,
      status: "starting",
      type: detected.type,
      label: detected.label,
      port,
    });
  }

  return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
}
