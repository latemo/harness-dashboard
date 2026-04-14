"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, CheckCircle2, Download, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSettings } from "@/hooks/useSettings";

export default function SettingsDialog() {
  const { settings, update } = useSettings();
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<"ko" | "en">("ko");
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState("");
  const [installError, setInstallError] = useState("");

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/setup");
      const data = await res.json();
      setInstalled(data.installed);
    } catch {
      setInstalled(false);
    }
  }, []);

  useEffect(() => {
    setLanguage(settings.language);
  }, [settings]);

  useEffect(() => {
    if (open) {
      checkStatus();
      setInstallMessage("");
      setInstallError("");
    }
  }, [open, checkStatus]);

  const handleInstall = async () => {
    setInstalling(true);
    setInstallMessage("");
    setInstallError("");
    try {
      const res = await fetch("/api/setup", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setInstalled(true);
        setInstallMessage(data.message);
      } else {
        setInstallError(data.error);
      }
    } catch (err) {
      setInstallError(String(err));
    } finally {
      setInstalling(false);
    }
  };

  const handleSave = () => {
    update({ language });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-accent hover:text-foreground text-muted-foreground"
          />
        }
      >
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline">설정</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>설정</DialogTitle>
          <DialogDescription>
            하네스 데이터 관리 및 언어 설정
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* 데이터 상태 */}
          <div className="space-y-3">
            <label className="text-sm font-medium">harness-100 데이터</label>

            {installed === null ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 확인 중...
              </div>
            ) : installed ? (
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-green-400">설치됨 (100개 하네스)</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleInstall}
                  disabled={installing}
                  className="gap-1.5"
                >
                  {installing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  업데이트
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
                <p className="text-sm text-muted-foreground">
                  GitHub에서 하네스 데이터를 다운로드합니다.
                </p>
                <Button
                  onClick={handleInstall}
                  disabled={installing}
                  className="w-full gap-2"
                >
                  {installing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      다운로드 중... (약 30초)
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      harness-100 다운로드
                    </>
                  )}
                </Button>
              </div>
            )}

            {installMessage && (
              <p className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> {installMessage}
              </p>
            )}
            {installError && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {installError}
              </p>
            )}
          </div>

          {/* 언어 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">하네스 언어</label>
            <div className="flex gap-2">
              <button
                onClick={() => setLanguage("ko")}
                className={`rounded-lg px-4 py-2 text-sm border transition-colors ${
                  language === "ko"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:bg-accent"
                }`}
              >
                한국어 (ko)
              </button>
              <button
                onClick={() => setLanguage("en")}
                className={`rounded-lg px-4 py-2 text-sm border transition-colors ${
                  language === "en"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:bg-accent"
                }`}
              >
                English (en)
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button onClick={handleSave}>
            저장
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
