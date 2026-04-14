import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function POST(req: NextRequest) {
  const { projectPath, stepIndex } = await req.json();

  if (!projectPath || stepIndex === undefined) {
    return NextResponse.json({ error: "projectPath와 stepIndex 필수" }, { status: 400 });
  }

  const workspacePath = path.join(projectPath, "_workspace");

  if (!fs.existsSync(workspacePath)) {
    return NextResponse.json({ archived: 0 });
  }

  const archivePath = path.join(workspacePath, `_step${stepIndex}`);
  if (!fs.existsSync(archivePath)) {
    fs.mkdirSync(archivePath, { recursive: true });
  }

  // _workspace/ 루트의 파일들을 _stepN/으로 이동
  const files = fs.readdirSync(workspacePath).filter((f) => {
    const fullPath = path.join(workspacePath, f);
    return !fs.statSync(fullPath).isDirectory();
  });

  for (const file of files) {
    const src = path.join(workspacePath, file);
    const dest = path.join(archivePath, file);
    fs.copyFileSync(src, dest);
    fs.unlinkSync(src);
  }

  return NextResponse.json({ archived: files.length, archivePath });
}
