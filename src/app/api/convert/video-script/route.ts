import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { marked } from "marked";
import puppeteer from "puppeteer";

/**
 * 영상 스크립트 변환: MD → SRT 자막 + 촬영 스크립트 PDF
 *
 * 타임코드 패턴 감지:
 *   - ## 섹션명 (0:00~1:00)
 *   - ## 섹션명 (1:05~3:00)
 *   - [00:00] 텍스트
 */

interface Segment {
  index: number;
  startTime: string; // "00:00:00,000"
  endTime: string;
  text: string;
  section: string;
}

// "0:00" or "1:05" → "00:00:00,000" (SRT 포맷)
function toSrtTime(t: string): string {
  const parts = t.trim().split(":").map(Number);
  let hours = 0, minutes = 0, seconds = 0;
  if (parts.length === 3) {
    [hours, minutes, seconds] = parts;
  } else if (parts.length === 2) {
    [minutes, seconds] = parts;
  } else {
    seconds = parts[0] || 0;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},000`;
}

// MD에서 타임코드 세그먼트 추출
function extractSegments(md: string): Segment[] {
  const segments: Segment[] = [];
  const lines = md.split("\n");

  // 패턴 1: ## 섹션명 (시작~끝) — 예: ## HOOK (0:00~1:00)
  const sectionPattern = /^#{1,3}\s+(.+?)\s*\((\d+:\d{2}(?::\d{2})?)\s*[~～\-–—]\s*(\d+:\d{2}(?::\d{2})?)\)/;

  // 패턴 2: [타임코드] 텍스트 — 예: [00:30] 안녕하세요
  const inlinePattern = /^\[(\d+:\d{2}(?::\d{2})?)\]\s*(.+)/;

  let currentSection = "";
  let currentStart = "";
  let currentEnd = "";
  let currentText: string[] = [];
  let segIndex = 1;

  const flushSection = () => {
    if (currentSection && currentStart && currentText.length > 0) {
      // 내레이션 텍스트만 추출 (마크다운 문법, 시각큐 등 제거)
      const narration = currentText
        .filter((l) => !l.startsWith("[") && !l.startsWith(">") && !l.startsWith("**시각") && !l.startsWith("- ["))
        .join(" ")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/\s+/g, " ")
        .trim();

      if (narration.length > 10) {
        segments.push({
          index: segIndex++,
          startTime: toSrtTime(currentStart),
          endTime: toSrtTime(currentEnd || currentStart),
          text: narration,
          section: currentSection,
        });
      }
    }
    currentText = [];
  };

  for (const line of lines) {
    const sectionMatch = line.match(sectionPattern);
    const inlineMatch = line.match(inlinePattern);

    if (sectionMatch) {
      flushSection();
      currentSection = sectionMatch[1].trim();
      currentStart = sectionMatch[2];
      currentEnd = sectionMatch[3];
    } else if (inlineMatch) {
      // 인라인 타임코드는 개별 세그먼트로
      const text = inlineMatch[2].replace(/\*\*(.+?)\*\*/g, "$1").trim();
      if (text.length > 5) {
        segments.push({
          index: segIndex++,
          startTime: toSrtTime(inlineMatch[1]),
          endTime: toSrtTime(inlineMatch[1]), // 다음 세그먼트에서 계산
          text,
          section: currentSection,
        });
      }
    } else if (line.startsWith("**내레이션") || line.startsWith("내레이션")) {
      // 내레이션 블록 시작 — 이후 텍스트 수집
      continue;
    } else if (currentSection && line.trim() && !line.startsWith("#") && !line.startsWith("---")) {
      currentText.push(line.trim());
    }
  }
  flushSection();

  // endTime 보정: 각 세그먼트의 endTime이 startTime과 같으면 다음 세그먼트의 startTime으로
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i].endTime === segments[i].startTime) {
      segments[i].endTime = segments[i + 1].startTime;
    }
  }

  return segments;
}

// SRT 형식으로 변환 (긴 텍스트는 42자 기준 줄바꿈)
function toSrt(segments: Segment[]): string {
  return segments
    .map((seg) => {
      // SRT 자막은 한 줄 42자 정도로 줄바꿈
      const lines = splitTextForSubtitle(seg.text, 42);
      return `${seg.index}\n${seg.startTime} --> ${seg.endTime}\n${lines}\n`;
    })
    .join("\n");
}

function splitTextForSubtitle(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;

  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if ((current + " " + word).trim().length > maxLen && current) {
      lines.push(current.trim());
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current.trim()) lines.push(current.trim());

  // 최대 2줄
  return lines.slice(0, 2).join("\n");
}

// 촬영 스크립트 PDF용 HTML 생성
function buildScriptHtml(segments: Segment[], originalFileName: string): string {
  const rows = segments
    .map(
      (seg) => `
    <tr>
      <td class="time">${seg.startTime.replace(",000", "")} ~ ${seg.endTime.replace(",000", "")}</td>
      <td class="section">${seg.section}</td>
      <td class="text">${seg.text}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Pretendard', -apple-system, sans-serif; padding: 40px 30px; color: #1a1a1a; }
  h1 { font-size: 20px; text-align: center; margin-bottom: 8px; }
  .meta { text-align: center; font-size: 12px; color: #666; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #003366; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
  td { padding: 8px 10px; border-bottom: 1px solid #ddd; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .time { width: 140px; font-family: monospace; font-size: 11px; color: #555; white-space: nowrap; }
  .section { width: 120px; font-weight: 600; color: #003366; }
  .text { line-height: 1.6; }
  .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #999; }
</style>
</head>
<body>
  <h1>촬영 스크립트</h1>
  <div class="meta">원본: ${originalFileName} | 세그먼트: ${segments.length}개 | 생성: ${new Date().toLocaleDateString("ko")}</div>
  <table>
    <thead>
      <tr><th>타임코드</th><th>섹션</th><th>내레이션/대사</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Harness Hub — Video Script Generator</div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const { projectPath, files } = await req.json();

  if (!projectPath || !files?.length) {
    return NextResponse.json({ success: false, error: "projectPath와 files 필수" }, { status: 400 });
  }

  const workspacePath = path.join(projectPath, "_workspace");
  const artifactsPath = path.join(workspacePath, "_artifacts");

  if (!fs.existsSync(workspacePath)) {
    return NextResponse.json({ success: false, error: "_workspace 폴더가 없습니다" }, { status: 404 });
  }

  if (!fs.existsSync(artifactsPath)) {
    fs.mkdirSync(artifactsPath, { recursive: true });
  }

  const outputFiles: string[] = [];
  let browser;

  try {
    for (const fileName of files) {
      const filePath = path.join(workspacePath, fileName);
      if (!fs.existsSync(filePath)) continue;

      const md = fs.readFileSync(filePath, "utf-8");
      const segments = extractSegments(md);

      if (segments.length === 0) {
        // 타임코드가 없는 일반 MD → 단순 PDF로 폴백
        continue;
      }

      const baseName = fileName.replace(/\.md$/i, "");

      // 1. SRT 자막 파일 생성
      const srt = toSrt(segments);
      const srtPath = path.join(artifactsPath, `${baseName}.srt`);
      fs.writeFileSync(srtPath, srt, "utf-8");
      outputFiles.push(`${baseName}.srt`);

      // 2. 촬영 스크립트 PDF 생성
      const scriptHtml = buildScriptHtml(segments, fileName);
      if (!browser) {
        browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
      }
      const page = await browser.newPage();
      await page.setContent(scriptHtml, { waitUntil: "networkidle0" });
      const pdfName = `${baseName}_촬영대본.pdf`;
      await page.pdf({
        path: path.join(artifactsPath, pdfName),
        format: "A4",
        landscape: true,
        printBackground: true,
        margin: { top: "15mm", right: "10mm", bottom: "15mm", left: "10mm" },
      });
      await page.close();
      outputFiles.push(pdfName);
    }

    if (outputFiles.length === 0) {
      return NextResponse.json({
        success: false,
        error: "타임코드가 포함된 스크립트를 찾을 수 없습니다. 스크립트 파일을 선택해주세요.",
      });
    }

    return NextResponse.json({ success: true, outputFiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : "영상 스크립트 변환 실패";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
