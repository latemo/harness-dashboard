import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { success: false, error: "슬라이드 변환은 아직 준비 중입니다 (Phase 3)" },
    { status: 501 }
  );
}
