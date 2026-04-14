import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const REPO_URL = "https://github.com/revfactory/harness-100.git";
const REPO_DIR = path.join(process.cwd(), "temp", "harness-100");

export async function GET() {
  const exists = fs.existsSync(path.join(REPO_DIR, "ko"));
  return NextResponse.json({
    installed: exists,
    path: REPO_DIR,
  });
}

export async function POST() {
  try {
    const exists = fs.existsSync(path.join(REPO_DIR, "ko"));

    if (exists) {
      // 이미 있으면 pull
      try {
        execSync("git pull", { cwd: REPO_DIR, timeout: 30000 });
        return NextResponse.json({
          success: true,
          action: "updated",
          message: "harness-100이 최신 상태로 업데이트되었습니다.",
        });
      } catch {
        return NextResponse.json({
          success: true,
          action: "exists",
          message: "harness-100이 이미 설치되어 있습니다.",
        });
      }
    }

    // 없으면 클론
    fs.mkdirSync(path.join(process.cwd(), "temp"), { recursive: true });
    execSync(`git clone --depth 1 ${REPO_URL} "${REPO_DIR}"`, {
      timeout: 120000,
    });

    return NextResponse.json({
      success: true,
      action: "cloned",
      message: "harness-100이 설치되었습니다. (100개 하네스, 904개 파일)",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
