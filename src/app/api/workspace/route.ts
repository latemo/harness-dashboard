import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const BINARY_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".gif", ".mp3", ".wav", ".mp4", ".webp"]);

function isBinary(fileName: string): boolean {
  return BINARY_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

export async function GET(req: NextRequest) {
  const projectPath = req.nextUrl.searchParams.get("projectPath");
  const file = req.nextUrl.searchParams.get("file");
  const subdir = req.nextUrl.searchParams.get("subdir"); // e.g. "_artifacts"

  if (!projectPath) {
    return NextResponse.json({ error: "projectPath 필수" }, { status: 400 });
  }

  const workspacePath = path.join(projectPath, "_workspace");
  const targetPath = subdir ? path.join(workspacePath, subdir) : workspacePath;

  // 특정 파일 내용 요청
  if (file) {
    const filePath = path.join(targetPath, file);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "파일 없음" }, { status: 404 });
    }

    // 바이너리 파일은 raw 응답
    if (isBinary(file)) {
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(file).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".mp4": "video/mp4",
      };
      return new Response(buffer, {
        headers: {
          "Content-Type": mimeMap[ext] || "application/octet-stream",
          "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file)}`,
        },
      });
    }

    const content = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json({ file, content });
  }

  // 파일 목록 요청
  if (!fs.existsSync(targetPath)) {
    return NextResponse.json({ files: [], exists: false });
  }

  const files = fs.readdirSync(targetPath)
    .filter((f) => !fs.statSync(path.join(targetPath, f)).isDirectory())
    .map((f) => {
      const stat = fs.statSync(path.join(targetPath, f));
      return {
        name: f,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // _artifacts 하위 디렉토리도 체크
  const artifactsPath = path.join(workspacePath, "_artifacts");
  let artifacts: { name: string; size: number; modified: string }[] = [];
  if (!subdir && fs.existsSync(artifactsPath)) {
    artifacts = fs.readdirSync(artifactsPath)
      .filter((f) => !fs.statSync(path.join(artifactsPath, f)).isDirectory())
      .map((f) => {
        const stat = fs.statSync(path.join(artifactsPath, f));
        return {
          name: f,
          size: stat.size,
          modified: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return NextResponse.json({ files, artifacts, exists: true });
}
