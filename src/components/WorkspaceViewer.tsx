"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FolderOpen,
  FileText,
  RefreshCw,
  ChevronLeft,
  Copy,
  Check,
  Download,
  Loader2,
  Printer,
  Code,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import TableOfContents from "@/components/TableOfContents";
import type { Heading } from "@/components/MarkdownRenderer";

interface FileInfo {
  name: string;
  size: number;
  modified: string;
}

interface Props {
  projectPath: string;
}

export default function WorkspaceViewer({ projectPath }: Props) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"raw" | "rendered">("rendered");
  const contentRef = useRef<HTMLDivElement>(null);

  const isMarkdown = selectedFile?.endsWith(".md") ?? false;
  const isBinaryFile = (name: string | null) => {
    if (!name) return false;
    return /\.(pdf|png|jpg|jpeg|gif|webp|mp3|wav|mp4|html|srt)$/i.test(name);
  };
  const isBinary = isBinaryFile(selectedFile);
  const [headings, setHeadings] = useState<Heading[]>([]);

  // DOM에서 실제 렌더링된 헤딩 추출 (rehype-slug가 부여한 id와 일치)
  useEffect(() => {
    if (!isMarkdown || !fileContent || viewMode !== "rendered" || loadingFile) {
      setHeadings([]);
      return;
    }
    // 렌더링 완료 후 DOM에서 추출하기 위해 약간 지연
    const timer = setTimeout(() => {
      const container = contentRef.current;
      if (!container) return;
      const els = container.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]");
      const extracted: Heading[] = [];
      els.forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const level = parseInt(tag.replace("h", ""), 10);
        extracted.push({
          level,
          text: el.textContent || "",
          id: el.id,
        });
      });
      setHeadings(extracted);
    }, 100);
    return () => clearTimeout(timer);
  }, [isMarkdown, fileContent, viewMode, loadingFile]);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspace?projectPath=${encodeURIComponent(projectPath)}`);
      const data = await res.json();
      setFiles(data.files || []);
      setExists(data.exists || false);
    } catch {
      setFiles([]);
      setExists(false);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const openFile = async (name: string) => {
    setLoadingFile(true);
    setSelectedFile(name);
    setViewMode(name.endsWith(".md") ? "rendered" : "raw");

    // 바이너리 파일은 내용을 fetch하지 않음 (URL로 직접 렌더링)
    if (isBinaryFile(name)) {
      setFileContent("");
      setLoadingFile(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/workspace?projectPath=${encodeURIComponent(projectPath)}&file=${encodeURIComponent(name)}`
      );
      const data = await res.json();
      setFileContent(data.content || "");
    } catch {
      setFileContent("파일을 읽을 수 없습니다.");
    } finally {
      setLoadingFile(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([fileContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedFile || "output.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    return `${(bytes / 1024).toFixed(1)}KB`;
  };

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-5 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">산출물 확인 중...</span>
        </CardContent>
      </Card>
    );
  }

  if (!exists || files.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              산출물 (_workspace/)
            </h3>
            <Button variant="ghost" size="sm" onClick={loadFiles} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              새로고침
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            아직 산출물이 없습니다. Claude Code를 실행하면 여기에 결과가 표시됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  // 파일 내용 보기 모드
  if (selectedFile) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-5 space-y-3">
          {/* 툴바 */}
          <div className="flex items-center justify-between no-print">
            <button
              onClick={() => setSelectedFile(null)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              목록으로 돌아가기
            </button>
            <div className="flex gap-1.5">
              {/* 뷰 모드 토글 (마크다운 파일만) */}
              {isMarkdown && (
                <div className="flex rounded-md border border-border/50 overflow-hidden mr-2">
                  <button
                    onClick={() => setViewMode("rendered")}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs transition-colors ${
                      viewMode === "rendered"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <BookOpen className="h-3 w-3" />
                    렌더링
                  </button>
                  <button
                    onClick={() => setViewMode("raw")}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs transition-colors ${
                      viewMode === "raw"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <Code className="h-3 w-3" />
                    원본
                  </button>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "복사됨" : "복사"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDownload} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                다운로드
              </Button>
              <Button variant="ghost" size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer className="h-3.5 w-3.5" />
                인쇄
              </Button>
            </div>
          </div>

          {/* 파일명 */}
          <div className="flex items-center gap-2 no-print">
            <FileText className="h-4 w-4 text-blue-400" />
            <span className="font-mono text-sm font-medium">{selectedFile}</span>
          </div>

          {/* 파일 내용 */}
          {loadingFile ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              로딩 중...
            </div>
          ) : isBinary ? (
            // 바이너리 파일 미리보기
            <BinaryPreview projectPath={projectPath} fileName={selectedFile!} />
          ) : viewMode === "raw" || !isMarkdown ? (
            // 원본 모드
            <div className="rounded-lg bg-[#0d1117] border border-border/30 p-4 font-mono text-sm leading-relaxed max-h-[600px] overflow-y-auto whitespace-pre-wrap text-gray-300">
              {fileContent}
            </div>
          ) : (
            // 렌더링 모드
            <div className="flex gap-4">
              <div
                ref={contentRef}
                className="markdown-body flex-1 rounded-lg bg-[#0d1117] border border-border/30 p-6 max-h-[600px] overflow-y-auto"
              >
                <MarkdownRenderer content={fileContent} />
              </div>
              {headings.length > 3 && (
                <div className="hidden lg:block w-48 shrink-0">
                  <div className="sticky top-0 max-h-[600px] overflow-y-auto">
                    <TableOfContents headings={headings} containerRef={contentRef} />
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // 파일 목록 모드
  return (
    <Card className="border-border/50">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            산출물 (_workspace/) — {files.length}개 파일
          </h3>
          <Button variant="ghost" size="sm" onClick={loadFiles} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            새로고침
          </Button>
        </div>

        <div className="space-y-1">
          {files.map((f) => (
            <button
              key={f.name}
              onClick={() => openFile(f.name)}
              className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-accent/50 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                <span className="text-sm font-mono group-hover:text-primary transition-colors">
                  {f.name}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{formatSize(f.size)}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function BinaryPreview({ projectPath, fileName }: { projectPath: string; fileName: string }) {
  const url = `/api/workspace?projectPath=${encodeURIComponent(projectPath)}&file=${encodeURIComponent(fileName)}`;
  const ext = fileName.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "pdf":
      return (
        <iframe
          src={url}
          className="w-full h-[600px] rounded-lg border border-border/30"
          title={fileName}
        />
      );
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
    case "gif":
      return (
        <div className="rounded-lg bg-[#0d1117] border border-border/30 p-4 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={fileName}
            className="max-w-full max-h-[600px] object-contain"
          />
        </div>
      );
    case "mp3":
    case "wav":
      return (
        <div className="rounded-lg bg-[#0d1117] border border-border/30 p-6 flex justify-center">
          <audio controls src={url} className="w-full max-w-md" />
        </div>
      );
    case "html":
      return (
        <iframe
          src={url}
          sandbox="allow-scripts"
          className="w-full h-[600px] rounded-lg border border-border/30 bg-white"
          title={fileName}
        />
      );
    default:
      return (
        <div className="rounded-lg bg-[#0d1117] border border-border/30 p-6 text-center text-sm text-muted-foreground">
          이 파일 형식은 미리보기를 지원하지 않습니다.
        </div>
      );
  }
}
