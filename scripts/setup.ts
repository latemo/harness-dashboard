/**
 * 초기 셋업 스크립트
 * 1. harness-100 레포가 없으면 git clone
 * 2. 데이터 JSON 생성
 */
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const REPO_URL = "https://github.com/revfactory/harness-100.git";
const REPO_DIR = path.join(__dirname, "..", "temp", "harness-100");
const DATA_FILE = path.join(__dirname, "..", "src", "data", "harnesses.json");

// Step 1: Clone if needed
if (!fs.existsSync(path.join(REPO_DIR, "ko"))) {
  console.log("📦 harness-100 다운로드 중...");
  fs.mkdirSync(path.join(__dirname, "..", "temp"), { recursive: true });
  execSync(`git clone --depth 1 ${REPO_URL} "${REPO_DIR}"`, {
    stdio: "inherit",
    timeout: 120000,
  });
  console.log("✅ 다운로드 완료");
} else {
  console.log("✅ harness-100 이미 존재");
}

// Step 2: Generate data if needed
if (!fs.existsSync(DATA_FILE)) {
  console.log("📊 데이터 생성 중...");
  execSync(`npx tsx "${path.join(__dirname, "generate-data.ts")}"`, {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  });
} else {
  console.log("✅ 데이터 파일 이미 존재");
}
