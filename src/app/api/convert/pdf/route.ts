import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { marked } from "marked";
import puppeteer from "puppeteer";
import { getThemeCSS, type PdfTheme } from "@/lib/pdf-themes";

export async function POST(req: NextRequest) {
  const { projectPath, files, options } = await req.json();

  if (!projectPath || !files?.length) {
    return NextResponse.json(
      { success: false, error: "projectPath와 files 필수" },
      { status: 400 }
    );
  }

  const workspacePath = path.join(projectPath, "_workspace");
  const artifactsPath = path.join(workspacePath, "_artifacts");

  if (!fs.existsSync(workspacePath)) {
    return NextResponse.json(
      { success: false, error: "_workspace 폴더가 없습니다" },
      { status: 404 }
    );
  }

  // _artifacts 디렉토리 생성
  if (!fs.existsSync(artifactsPath)) {
    fs.mkdirSync(artifactsPath, { recursive: true });
  }

  const theme: PdfTheme = options?.pdfTheme || "default";
  const css = getThemeCSS(theme);
  const outputFiles: string[] = [];

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    for (const fileName of files) {
      const filePath = path.join(workspacePath, fileName);
      if (!fs.existsSync(filePath)) continue;

      const md = fs.readFileSync(filePath, "utf-8");
      const html = await marked(md);

      const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>${css}</style>
</head>
<body>${html}</body>
</html>`;

      const page = await browser.newPage();
      await page.setContent(fullHtml, { waitUntil: "networkidle0" });

      const pdfName = fileName.replace(/\.md$/i, ".pdf");
      const pdfPath = path.join(artifactsPath, pdfName);

      await page.pdf({
        path: pdfPath,
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
      });

      await page.close();
      outputFiles.push(pdfName);
    }

    return NextResponse.json({ success: true, outputFiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF 변환 실패";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
