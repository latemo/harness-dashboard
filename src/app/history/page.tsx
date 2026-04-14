"use client";

import Link from "next/link";
import { History, ArrowLeft, Trash2, FolderOpen, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useHistory } from "@/hooks/useHistory";

export default function HistoryPage() {
  const { history, clearHistory } = useHistory();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="h-4 w-4" />
            카탈로그로 돌아가기
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            적용 이력 ({history.length})
          </h1>
        </div>
        {history.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearHistory} className="gap-2 text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
            전체 삭제
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">적용 이력이 없습니다</p>
          <p className="text-sm mt-1">하네스를 프로젝트에 적용하면 여기에 기록됩니다</p>
          <Link href="/" className="inline-flex items-center gap-1 mt-4 text-sm text-primary hover:underline">
            카탈로그 보기 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-muted-foreground">
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <Link href={`/harness/${entry.harnessId}`} className="font-medium text-sm hover:text-primary transition-colors">
                      {entry.harnessTitle}
                    </Link>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{entry.projectPath}</p>
                  </div>
                </div>
                <time className="text-xs text-muted-foreground shrink-0">
                  {new Date(entry.appliedAt).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
