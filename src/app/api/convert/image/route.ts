import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { success: false, error: "이미지 생성은 아직 준비 중입니다 (Phase 4 - OpenAI API 키 필요)" },
    { status: 501 }
  );
}
