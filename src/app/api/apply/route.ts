import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { harnessId, repoPath, language, projectPath } = await req.json();

    if (!harnessId || !repoPath || !projectPath) {
      return NextResponse.json(
        { error: "harnessId, repoPath, projectPath 필수" },
        { status: 400 }
      );
    }

    const lang = language || "ko";

    // 소스: harness-100 레포의 .claude/ 폴더
    const sourcePath = path.join(repoPath, lang, harnessId, ".claude");
    if (!fs.existsSync(sourcePath)) {
      return NextResponse.json(
        { error: `소스를 찾을 수 없습니다: ${sourcePath}` },
        { status: 404 }
      );
    }

    // 대상: 프로젝트/.claude/
    const destPath = path.join(projectPath, ".claude");

    // 이미 .claude/ 가 있으면 덮어쓰기 경고
    const alreadyExists = fs.existsSync(destPath);

    // 프로젝트 폴더 + .claude/ 자동 생성 & 복사
    copyDirSync(sourcePath, destPath);

    // 복사된 파일 수 카운트
    let fileCount = 0;
    function countFiles(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          countFiles(path.join(dir, entry.name));
        } else {
          fileCount++;
        }
      }
    }
    countFiles(destPath);

    return NextResponse.json({
      success: true,
      projectPath,
      destPath,
      fileCount,
      overwritten: alreadyExists,
      message: `${harnessId} 하네스가 ${projectPath}에 적용되었습니다. (${fileCount}개 파일)`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
