import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { success: false, error: "코드 프로젝트 변환은 아직 준비 중입니다 (Phase 2)" },
    { status: 501 }
  );
}
