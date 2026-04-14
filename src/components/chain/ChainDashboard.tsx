"use client";

import { useState } from "react";
import { Plus, Play, Trash2, Download, Upload, Clock, ArrowRight, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Chain, ChainTemplate, HarnessSummary } from "@/lib/types";
import { CHAIN_TEMPLATES } from "@/lib/chain-templates";
import { useChains } from "@/hooks/useChains";
import { useChainHistory } from "@/hooks/useChainHistory";
import ChainBuilder from "./ChainBuilder";
import ChainExecutor from "./ChainExecutor";
import ChainTemplateCard from "./ChainTemplateCard";

interface Props {
  harnesses: HarnessSummary[];
  outputsMap: Record<string, string[]>;
}

type View = "list" | "build" | "execute";

export default function ChainDashboard({ harnesses, outputsMap }: Props) {
  const { chains, saveChain, deleteChain, exportChain, importChain } = useChains();
  const { history } = useChainHistory();
  const [view, setView] = useState<View>("list");
  const [editingChain, setEditingChain] = useState<Chain | undefined>();
  const [executingChain, setExecutingChain] = useState<Chain | null>(null);

  const handleUseTemplate = (template: ChainTemplate) => {
    const now = new Date().toISOString();
    const chain: Chain = {
      id: crypto.randomUUID(),
      name: template.name,
      description: template.description,
      steps: template.steps.map((s, i) => ({ ...s, stepIndex: i })),
      createdAt: now,
      updatedAt: now,
    };
    setEditingChain(chain);
    setView("build");
  };

  const handleSave = (chain: Chain) => {
    saveChain(chain);
    setEditingChain(undefined);
    setView("list");
  };

  const handleEdit = (chain: Chain) => {
    setEditingChain(chain);
    setView("build");
  };

  const handleExecute = (chain: Chain) => {
    setExecutingChain(chain);
    setView("execute");
  };

  const handleExport = (id: string) => {
    const json = exportChain(id);
    if (!json) return;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chain-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      importChain(text);
    };
    input.click();
  };

  // 빌더 뷰
  if (view === "build") {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          {editingChain?.id ? "체인 편집" : "새 체인 만들기"}
        </h2>
        <ChainBuilder
          harnesses={harnesses}
          initialChain={editingChain}
          outputsMap={outputsMap}
          onSave={handleSave}
          onCancel={() => {
            setEditingChain(undefined);
            setView("list");
          }}
        />
      </div>
    );
  }

  // 실행 뷰
  if (view === "execute" && executingChain) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Play className="h-5 w-5" />
            체인 실행: {executingChain.name}
          </h2>
          <Button
            variant="ghost"
            onClick={() => {
              setExecutingChain(null);
              setView("list");
            }}
          >
            목록으로
          </Button>
        </div>
        <ChainExecutor chain={executingChain} />
      </div>
    );
  }

  // 리스트 뷰
  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-6 w-6" />
            체인 빌더
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            여러 하네스를 연결하여 순차 실행 파이프라인을 만듭니다
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleImport} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            가져오기
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingChain(undefined);
              setView("build");
            }}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            새 체인
          </Button>
        </div>
      </div>

      {/* 추천 템플릿 */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">추천 템플릿</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {CHAIN_TEMPLATES.map((t) => (
            <ChainTemplateCard key={t.id} template={t} onUse={handleUseTemplate} />
          ))}
        </div>
      </section>

      {/* 내 체인 */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          내 체인 ({chains.length})
        </h2>
        {chains.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-10 text-center text-muted-foreground">
              <p className="text-sm">아직 저장된 체인이 없습니다</p>
              <p className="text-xs mt-1">위 템플릿을 사용하거나 새 체인을 만들어보세요</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {chains.map((chain) => (
              <Card key={chain.id} className="border-border/50 hover:border-border transition-all">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">{chain.name}</h3>
                    {chain.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {chain.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {chain.steps.map((step, i) => (
                      <span key={step.harnessId} className="flex items-center gap-1">
                        <span className="font-mono">#{String(step.harnessNumber).padStart(2, "0")}</span>
                        {i < chain.steps.length - 1 && <ArrowRight className="h-3 w-3" />}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">
                      {chain.steps.length}단계
                    </Badge>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExport(chain.id)}
                        className="h-7 w-7 p-0"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(chain)}
                        className="h-7 px-2 text-xs"
                      >
                        편집
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteChain(chain.id)}
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleExecute(chain)}
                        className="h-7 px-2 text-xs gap-1"
                      >
                        <Play className="h-3 w-3" />
                        실행
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 실행 이력 */}
      {history.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">
            최근 실행 이력
          </h2>
          <div className="space-y-2">
            {history.slice(0, 10).map((entry, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-border/30 px-4 py-2.5 text-sm"
              >
                <div className="flex items-center gap-3">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{entry.chainName}</span>
                  <span className="text-xs text-muted-foreground font-mono">{entry.projectPath}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {entry.stepCount}단계
                  </Badge>
                  <span
                    className={`text-xs font-medium ${
                      entry.status === "complete" ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {entry.status === "complete" ? "완료" : "오류"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.executedAt).toLocaleDateString("ko")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
