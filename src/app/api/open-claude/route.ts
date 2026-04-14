import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import { exec } from "child_process";

export async function POST(req: NextRequest) {
  try {
    const { projectPath, dangerousMode } = await req.json();

    if (!projectPath) {
      return NextResponse.json({ error: "projectPath 필수" }, { status: 400 });
    }

    if (!fs.existsSync(projectPath)) {
      return NextResponse.json(
        { error: `폴더가 존재하지 않습니다: ${projectPath}` },
        { status: 404 }
      );
    }

    const claudeCmd = dangerousMode ? "claude --dangerously-skip-permissions" : "claude";
    const modeLabel = dangerousMode ? "바이패스" : "일반";

    // Windows Terminal → cmd 폴백
    const cmd = `start wt -d "${projectPath}" cmd /k ${claudeCmd}`;
    exec(cmd, (err) => {
      if (err) {
        exec(`start cmd /k "cd /d "${projectPath}" && ${claudeCmd}"`, () => {});
      }
    });

    return NextResponse.json({
      success: true,
      message: `Claude Code (${modeLabel})를 ${projectPath}에서 실행합니다.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
