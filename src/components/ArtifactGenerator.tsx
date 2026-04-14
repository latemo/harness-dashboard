"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Code,
  Presentation,
  Volume2,
  ImageIcon,
  Film,
  Loader2,
  Download,
  Eye,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  type ArtifactType,
  getArtifactTypes,
  ARTIFACT_TYPES,
} from "@/lib/artifact-config";
import { PDF_THEMES, type PdfTheme } from "@/lib/pdf-themes";
import type { Category } from "@/lib/types";

interface FileInfo {
  name: string;
  size: number;
  modified: string;
}

interface Props {
  projectPath: string;
  harnessNumber: number;
  category: Category;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  Code,
  Presentation,
  Volume2,
  ImageIcon,
  Film,
};

export default function ArtifactGenerator({ projectPath, harnessNumber, category }: Props) {
  const [workspaceFiles, setWorkspaceFiles] = useState<FileInfo[]>([]);
  const [artifacts, setArtifacts] = useState<FileInfo[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [converting, setConverting] = useState(false);
  const [convertResult, setConvertResult] = useState<{
    success: boolean;
    message: string;
    files?: string[];
  } | null>(null);
  const [pdfTheme, setPdfTheme] = useState<PdfTheme>("default");
  const [previewFile, setPreviewFile] = useState<string | null>(null);

  const availableTypes = getArtifactTypes(harnessNumber, category);
  const [activeType, setActiveType] = useState<ArtifactType>(availableTypes[0]);

  // 타입 변경 시 적절한 파일 자동 선택
  const isScriptFile = (name: string) =>
    /script|subtitle|대본|자막/i.test(name);

  const handleTypeChange = (type: ArtifactType) => {
    setActiveType(type);
    if (workspaceFiles.length === 0) return;

    if (type === "video-script") {
      // 영상 스크립트 모드: 스크립트/자막 파일만 선택
      const scriptFiles = workspaceFiles.filter((f) => isScriptFile(f.name));
      setSelectedFiles(
        new Set<string>(
          scriptFiles.length > 0
            ? scriptFiles.map((f) => f.name)
            : workspaceFiles.map((f) => f.name)
        )
      );
    } else {
      // 기본: 전체 선택
      setSelectedFiles(new Set<string>(workspaceFiles.map((f) => f.name)));
    }
  };

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/workspace?projectPath=${encodeURIComponent(projectPath)}`
      );
      const data = await res.json();
      const mdFiles = (data.files || []).filter((f: FileInfo) =>
        f.name.endsWith(".md")
      );
      setWorkspaceFiles(mdFiles);
      setArtifacts(data.artifacts || []);

      // 기본 전체 선택
      const defaultSelected = new Set<string>(
        mdFiles.map((f: FileInfo) => f.name)
      );
      setSelectedFiles(defaultSelected);
    } catch {
      setWorkspaceFiles([]);
      setArtifacts([]);
    }
  }, [projectPath]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const toggleFile = (name: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedFiles(new Set(workspaceFiles.map((f) => f.name)));
  };

  const deselectAll = () => {
    setSelectedFiles(new Set());
  };

  const handleConvert = async () => {
    if (selectedFiles.size === 0) return;
    setConverting(true);
    setConvertResult(null);

    try {
      const body = {
        projectPath,
        files: Array.from(selectedFiles),
        options: { pdfTheme },
      };

      const res = await fetch(`/api/convert/${activeType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        setConvertResult({
          success: false,
          message: `이 변환 타입(${ARTIFACT_TYPES[activeType].label})은 아직 지원되지 않습니다`,
        });
        setConverting(false);
        return;
      }

      const data = await res.json();

      if (data.success) {
        setConvertResult({
          success: true,
          message: `${data.outputFiles.length}개 파일 변환 완료`,
          files: data.outputFiles,
        });
        // 아티팩트 목록 새로고침
        await loadFiles();
      } else {
        setConvertResult({
          success: false,
          message: data.error || "변환 실패",
        });
      }
    } catch (err) {
      setConvertResult({
        success: false,
        message: err instanceof Error ? err.message : "변환 중 오류 발생",
      });
    } finally {
      setConverting(false);
    }
  };

  const handleDownload = (fileName: string) => {
    const url = `/api/workspace?projectPath=${encodeURIComponent(projectPath)}&subdir=_artifacts&file=${encodeURIComponent(fileName)}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // 워크스페이스에 MD 파일이 없으면 표시하지 않음
  if (workspaceFiles.length === 0) return null;

  return (
    <Card className="border-border/50">
      <CardContent className="p-5 space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-400" />
            아티팩트 생성
          </h3>
          <Button variant="ghost" size="sm" onClick={loadFiles} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            새로고침
          </Button>
        </div>

        {/* 변환 타입 선택 */}
        <div className="flex gap-1.5 flex-wrap">
          {availableTypes.map((type) => {
            const config = ARTIFACT_TYPES[type];
            const Icon = ICON_MAP[config.icon] || FileText;
            return (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeType === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent/50 text-muted-foreground hover:bg-accent"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {config.label}
              </button>
            );
          })}
        </div>

        {/* 설명 */}
        <p className="text-xs text-muted-foreground">
          {ARTIFACT_TYPES[activeType].description}
        </p>

        {/* PDF 테마 선택 (PDF 타입일 때만) */}
        {activeType === "pdf" && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              PDF 테마
            </label>
            <div className="flex gap-1.5">
              {PDF_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setPdfTheme(t.id)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    pdfTheme === t.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent/50 text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 대상 파일 선택 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              대상 파일 ({selectedFiles.size}/{workspaceFiles.length})
            </label>
            <div className="flex gap-2 text-xs">
              <button
                onClick={selectAll}
                className="text-blue-400 hover:underline"
              >
                전체선택
              </button>
              <button
                onClick={deselectAll}
                className="text-muted-foreground hover:underline"
              >
                해제
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {workspaceFiles.map((f) => {
              const disabled =
                activeType === "video-script" && !isScriptFile(f.name);
              return (
                <label
                  key={f.name}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm ${
                    disabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-accent/30 cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(f.name)}
                    onChange={() => !disabled && toggleFile(f.name)}
                    disabled={disabled}
                    className="rounded border-border/50"
                  />
                  <span className="font-mono text-xs truncate flex-1">
                    {f.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatSize(f.size)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 변환 버튼 */}
        <Button
          onClick={handleConvert}
          disabled={converting || selectedFiles.size === 0}
          className="w-full gap-2"
          size="sm"
        >
          {converting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              변환 중...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {ARTIFACT_TYPES[activeType].label}로 변환 ({selectedFiles.size}개
              파일)
            </>
          )}
        </Button>

        {/* 변환 결과 */}
        {convertResult && (
          <div
            className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
              convertResult.success
                ? "bg-green-500/10 border border-green-500/30"
                : "bg-red-500/10 border border-red-500/30"
            }`}
          >
            {convertResult.success ? (
              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <span
              className={
                convertResult.success ? "text-green-400" : "text-red-400"
              }
            >
              {convertResult.message}
            </span>
          </div>
        )}

        {/* 생성된 아티팩트 목록 */}
        {artifacts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              생성된 아티팩트 ({artifacts.length})
            </h4>
            <div className="space-y-1">
              {artifacts.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center justify-between rounded-lg px-3 py-2 bg-accent/30 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ArtifactIcon fileName={f.name} />
                    <span className="font-mono text-xs truncate">
                      {f.name}
                    </span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {formatSize(f.size)}
                    </Badge>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setPreviewFile(previewFile === f.name ? null : f.name)
                      }
                      className="h-7 w-7 p-0"
                      title="미리보기"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(f.name)}
                      className="h-7 w-7 p-0"
                      title="다운로드"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 미리보기 영역 */}
        {previewFile && (
          <div className="rounded-lg border border-border/30 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-accent/30 border-b border-border/30">
              <span className="text-xs font-mono">{previewFile}</span>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                닫기
              </button>
            </div>
            <ArtifactPreview
              projectPath={projectPath}
              fileName={previewFile}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ArtifactIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return <FileText className="h-3.5 w-3.5 text-red-400 shrink-0" />;
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
      return <ImageIcon className="h-3.5 w-3.5 text-green-400 shrink-0" />;
    case "mp3":
    case "wav":
      return <Volume2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
    case "html":
      return <Presentation className="h-3.5 w-3.5 text-orange-400 shrink-0" />;
    case "srt":
      return <Film className="h-3.5 w-3.5 text-purple-400 shrink-0" />;
    default:
      return <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />;
  }
}

function ArtifactPreview({
  projectPath,
  fileName,
}: {
  projectPath: string;
  fileName: string;
}) {
  const url = `/api/workspace?projectPath=${encodeURIComponent(projectPath)}&subdir=_artifacts&file=${encodeURIComponent(fileName)}`;
  const ext = fileName.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "pdf":
      return (
        <iframe
          src={url}
          className="w-full h-[500px]"
          title={fileName}
        />
      );
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
    case "gif":
      return (
        <div className="p-4 flex justify-center bg-[#0d1117]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={fileName}
            className="max-w-full max-h-[500px] object-contain"
          />
        </div>
      );
    case "mp3":
    case "wav":
      return (
        <div className="p-4 flex justify-center">
          <audio controls src={url} className="w-full max-w-md" />
        </div>
      );
    case "html":
      return (
        <iframe
          src={url}
          sandbox="allow-scripts"
          className="w-full h-[500px] bg-white"
          title={fileName}
        />
      );
    default:
      return (
        <div className="p-4 text-sm text-muted-foreground text-center">
          이 파일 형식은 미리보기를 지원하지 않습니다. 다운로드하여 확인하세요.
        </div>
      );
  }
}
