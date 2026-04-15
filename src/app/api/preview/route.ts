import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";

interface PreviewState {
  proc?: ChildProcessWithoutNullStreams;       // 프론트엔드 프로세스
  backendProc?: ChildProcessWithoutNullStreams; // 백엔드 프로세스 (fullstack)
  port: number;
  backendPort?: number;
  type: string;
  url: string;
  status: "starting" | "running" | "error";
  logs: string[];
}

const previews = new Map<string, PreviewState>();
let nextPort = 9100;

// 핫리로드 시 고아 프로세스 정리 (Next.js dev 환경)
if (process.env.NODE_ENV === "development") {
  const g = globalThis as typeof globalThis & { __previewCleanup?: () => void };
  if (g.__previewCleanup) g.__previewCleanup();
  g.__previewCleanup = () => {
    for (const [, state] of previews) {
      state.proc?.kill("SIGTERM");
      state.backendProc?.kill("SIGTERM");
    }
    previews.clear();
  };
}

/**
 * 프로젝트 유형 감지
 */
function detectProjectType(projectPath: string): {
  type: string;
  root: string;
  label: string;
  backendRoot?: string;
  backendPort?: number;
  fePort?: number; // FRONTEND_URL에서 읽은 프론트엔드 포트
} | null {
  // ── Fullstack 감지: frontend + backend 디렉토리가 나란히 있는 경우 ──
  const checkFullstack = (base: string) => {
    const candidates = [
      { fe: "frontend", be: "backend" },
      { fe: "client", be: "server" },
      { fe: "web", be: "api" },
    ];
    for (const { fe, be } of candidates) {
      const feDir = path.join(base, fe);
      const beDir = path.join(base, be);
      if (
        fs.existsSync(path.join(feDir, "package.json")) &&
        fs.existsSync(path.join(beDir, "package.json"))
      ) {
        // 백엔드 .env에서 PORT, FRONTEND_URL 추출
        let bePort = 4000;
        let fePort: number | undefined;
        const envFile = path.join(beDir, ".env");
        if (fs.existsSync(envFile)) {
          const envContent = fs.readFileSync(envFile, "utf-8");
          const portMatch = envContent.match(/^PORT\s*=\s*(\d+)/m);
          if (portMatch) bePort = parseInt(portMatch[1]);
          // FRONTEND_URL에서 포트 추출 → 프론트엔드를 이 포트로 실행 (따옴표 있/없 모두 처리)
          const feUrlMatch = envContent.match(/^FRONTEND_URL\s*=\s*["']?https?:\/\/[^:'"]+:(\d+)/m);
          if (feUrlMatch) fePort = parseInt(feUrlMatch[1]);
        }
        return { feDir, beDir, bePort, fePort };
      }
    }
    return null;
  };

  // src/ 하위에서 fullstack 패턴 우선 검색
  const srcDir = path.join(projectPath, "src");
  const wsDir = path.join(projectPath, "_workspace");
  for (const base of [srcDir, wsDir, projectPath]) {
    if (!fs.existsSync(base)) continue;
    const fs2 = checkFullstack(base);
    if (fs2) {
      return {
        type: "fullstack",
        root: fs2.feDir,
        label: "Fullstack (Frontend + Backend)",
        backendRoot: fs2.beDir,
        backendPort: fs2.bePort,
        fePort: fs2.fePort,
      };
    }
  }

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

function isPortFree(port: number): boolean {
  // netstat 없이 간단하게 실제 OS 포트 점유 여부 확인
  try {
    const net = require("net") as typeof import("net");
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => { server.close(); resolve(true); });
      server.listen(port, "127.0.0.1");
    }) as unknown as boolean; // sync 흉내 — 실제론 아래 getPortAsync 사용
  } catch { return false; }
}

async function getPortAsync(preferred?: number): Promise<number> {
  const net = await import("net");
  const usedInMap = new Set([...previews.values()].map((s) => s.port));
  const start = preferred ?? 9100;

  const check = (port: number): Promise<boolean> =>
    new Promise((resolve) => {
      if (usedInMap.has(port)) return resolve(false);
      const s = net.default.createServer();
      s.once("error", () => resolve(false));
      s.once("listening", () => { s.close(); resolve(true); });
      s.listen(port, "127.0.0.1");
    });

  let port = start;
  while (!(await check(port))) port++;
  return port;
}

function getPort(): number {
  // 간단 fallback (비동기 불가 컨텍스트용): previews Map 기준
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
    case "fullstack":
      return {
        setupCmd: "npm install",
        cmd: "npx",
        args: ["next", "dev", "--port", String(port)],
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
    // 감지된 프로젝트 타입이 실행 중인 서버와 다르면 stale 서버 종료
    if (existing && existing.type !== result.type) {
      existing.proc?.kill("SIGTERM");
      previews.delete(projectPath);
    }
    const fresh = previews.get(projectPath);
    return NextResponse.json({
      detected: true,
      type: result.type,
      label: result.label,
      root: result.root,
      backendPort: result.backendPort,
      running: fresh?.status === "running",
      url: fresh?.url,
    });
  }

  // ── 중지 ──
  if (action === "stop") {
    const state = previews.get(projectPath);
    if (state) {
      state.proc?.kill("SIGTERM");
      state.backendProc?.kill("SIGTERM");
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

    // fullstack: FRONTEND_URL 포트를 우선 사용 (CORS 설정과 일치시키기 위해)
    // 실제 OS 포트 점유 여부까지 확인해서 충돌 방지
    const port = await getPortAsync(detected.fePort ?? 9100);
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

    // ── 프로세스 시작 헬퍼 ──
    const spawnServer = (
      spawnCmd: string,
      spawnArgs: string[],
      cwd: string,
      spawnEnv: Record<string, string>,
      label: string,
    ): ChildProcessWithoutNullStreams => {
      const proc = spawn(spawnCmd, spawnArgs, {
        cwd,
        shell: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...spawnEnv },
      });
      const isRunning = (text: string) =>
        text.includes("localhost") ||
        text.includes("Local:") ||
        text.includes("Accepting connections") ||
        text.includes("listening") ||
        text.includes("ready") ||
        text.includes("Started") ||
        text.includes("Running on") ||
        text.includes("debug service");

      const onData = (chunk: Buffer) => {
        const text = chunk.toString("utf-8");
        state.logs.push(`[${label}] ${text}`);
        if (state.logs.length > 300) state.logs.shift();
        if (isRunning(text)) {
          state.status = "running";
          // 실제 바인딩 포트를 로그에서 파싱해 URL 업데이트
          // npx serve: "Accepting connections at http://localhost:PORT"
          // next dev: "Local: http://localhost:PORT", "Ready on http://localhost:PORT"
          const urlMatch = text.match(/https?:\/\/localhost:(\d+)/i);
          if (urlMatch && label === "frontend") {
            const actualPort = parseInt(urlMatch[1]);
            if (actualPort !== state.port) {
              state.port = actualPort;
              state.url = `http://localhost:${actualPort}`;
            }
          }
        }
      };
      proc.stdout.on("data", onData);
      proc.stderr.on("data", onData);
      proc.on("error", (err) => {
        state.logs.push(`[${label} error] ${err.message}\n`);
      });
      proc.on("close", (code) => {
        state.logs.push(`[${label}] process exited with code ${code}\n`);
        const s = previews.get(projectPath);
        if (s && s.proc !== proc && s.backendProc !== proc) return;
        if (s && s.status !== "running") {
          s.status = "error";
          setTimeout(() => { if (previews.get(projectPath) === s) previews.delete(projectPath); }, 300000);
        } else if (s) {
          previews.delete(projectPath);
        }
      });
      return proc;
    };

    // 비동기로 빌드 + 서버 시작 파이프라인 실행 (API는 즉시 응답)
    (async () => {
      // 의존성 설치 (프론트엔드)
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
              if (state.logs.length > 300) state.logs.shift();
            });
            setupProc.stderr.on("data", (chunk: Buffer) => {
              state.logs.push(chunk.toString("utf-8"));
              if (state.logs.length > 300) state.logs.shift();
            });
            setupProc.on("close", (code) => {
              if (code === 0) resolve();
              else reject(new Error(`setup exited with code ${code}`));
            });
            setupProc.on("error", reject);
            setTimeout(() => { setupProc.kill("SIGTERM"); reject(new Error("setup timeout (5min)")); }, 300000);
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          state.logs.push(`[setup error] ${msg}\n`);
          state.status = "error";
          return;
        }
      }

      // ── Fullstack: 백엔드 먼저 시작 ──
      if (detected.type === "fullstack" && detected.backendRoot) {
        state.logs.push(`[backend] npm install\n`);
        try {
          const cp = await import("child_process");
          await new Promise<void>((resolve) => {
            const p = cp.spawn("npm install", [], { cwd: detected.backendRoot, shell: true, stdio: "pipe" });
            p.on("close", () => resolve());
            p.on("error", () => resolve()); // 설치 실패해도 계속 진행
          });
        } catch { /* ignore */ }

        state.backendProc = spawnServer(
          "npm", ["run", "dev"],
          detected.backendRoot!,
          {},
          "backend",
        );
        state.backendPort = detected.backendPort;
        state.logs.push(`[backend] starting on port ${detected.backendPort ?? 4000}...\n`);
        // 백엔드가 준비될 때까지 잠시 대기 (2초)
        await new Promise((r) => setTimeout(r, 2000));
      }

      // ── 프론트엔드 시작 ──
      state.proc = spawnServer(cmd, args, detected.root, extraEnv ?? {}, "frontend");

      // 10분 타임아웃 (프론트엔드 기준)
      setTimeout(() => {
        const s = previews.get(projectPath);
        if (s?.proc === state.proc) {
          state.proc?.kill("SIGTERM");
          state.backendProc?.kill("SIGTERM");
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
