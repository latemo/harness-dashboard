import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

/**
 * 서버사이드 상태 저장 API
 * localStorage 대신 파일에 저장하여 포트 변경에도 데이터 유지
 */

const STATE_DIR = path.join(process.cwd(), ".state");

function ensureDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

function getFilePath(key: string): string {
  // 안전한 파일명으로 변환
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(STATE_DIR, `${safe}.json`);
}

export async function POST(req: NextRequest) {
  const { action, key, value } = await req.json();
  ensureDir();

  if (action === "get") {
    const filePath = getFilePath(key);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ value: null });
    }
    const data = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json({ value: JSON.parse(data) });
  }

  if (action === "set") {
    const filePath = getFilePath(key);
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    const filePath = getFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
