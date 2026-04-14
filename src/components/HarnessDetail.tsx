"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Puzzle,
  Heart,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderOpen,
  Terminal,
  Rocket,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { HarnessDetail as HarnessDetailType } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";
import { useFavorites } from "@/hooks/useFavorites";
import { useHistory } from "@/hooks/useHistory";
import { useSettings } from "@/hooks/useSettings";
import ExecutionPanel from "@/components/ExecutionPanel";
import WorkspaceViewer from "@/components/WorkspaceViewer";
import ArtifactGenerator from "@/components/ArtifactGenerator";

interface Props {
  harness: HarnessDetailType;
}

export default function HarnessDetailView({ harness }: Props) {
  const { addEntry, getLastPath } = useHistory();
  const lastPath = getLastPath(harness.id);
  const [projectPath, setProjectPath] = useState("");

  useEffect(() => {
    if (lastPath && !projectPath) {
      setProjectPath(lastPath);
    }
  }, [lastPath]); // eslint-disable-line react-hooks/exhaustive-deps
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ success: boolean; message: string } | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const { toggle, isFavorite } = useFavorites();
  const { settings } = useSettings();

  const category = CATEGORIES.find((c) => c.id === harness.category)!;
  const isFav = isFavorite(harness.id);

  const handleApply = async () => {
    if (!projectPath || !settings.repoPath) return;

    setApplying(true);
    setApplyResult(null);

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          harnessId: harness.id,
          repoPath: settings.repoPath,
          language: settings.language,
          projectPath,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setApplyResult({
          success: true,
          message: `${data.fileCount}개 파일이 ${projectPath}/.claude/에 복사되었습니다.`,
        });
        addEntry({ harnessId: harness.id, harnessTitle: harness.title, projectPath });
      } else {
        setApplyResult({ success: false, message: data.error });
      }
    } catch (err) {
      setApplyResult({ success: false, message: String(err) });
    } finally {
      setApplying(false);
    }
  };

  const handleOpenClaude = async (dangerousMode: boolean) => {
    try {
      await fetch("/api/open-claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath, dangerousMode }),
      });
    } catch {
      // 터미널 열기 실패해도 무시
    }
  };

  const orchestrator = harness.skills.find((s) => s.type === "orchestrator");
  const specializedSkills = harness.skills.filter((s) => s.type === "specialized");

  return (
    <div className="space-y-8">
      {/* Back + Header */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          카탈로그로 돌아가기
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-mono text-muted-foreground">
                #{String(harness.number).padStart(2, "0")}
              </span>
              <Badge variant="outline" className={`text-xs ${category.color}`}>
                {category.icon} {category.label}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold">{harness.title}</h1>
            <p className="mt-2 text-lg text-muted-foreground">{harness.description}</p>
          </div>
          <button onClick={() => toggle(harness.id)} className="shrink-0 mt-2">
            <Heart className={`h-6 w-6 transition-colors ${isFav ? "fill-red-400 text-red-400" : "text-muted-foreground hover:text-red-400"}`} />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="flex items-center gap-3 p-4">
            <Bot className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-xl font-bold">{harness.agentCount}</p>
              <p className="text-xs text-muted-foreground">에이전트</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="flex items-center gap-3 p-4">
            <Puzzle className="h-5 w-5 text-purple-400" />
            <div>
              <p className="text-xl font-bold">{harness.skillCount}</p>
              <p className="text-xs text-muted-foreground">스킬</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="flex items-center gap-3 p-4">
            <FileText className="h-5 w-5 text-green-400" />
            <div>
              <p className="text-xl font-bold">{harness.outputs.length}</p>
              <p className="text-xs text-muted-foreground">산출물</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Apply Section */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            프로젝트에 적용하기
          </h2>

          <p className="text-sm text-muted-foreground leading-relaxed">
            프로젝트 경로를 입력하고 <strong className="text-foreground">적용</strong> 버튼을 누르면,
            폴더 생성 + 에이전트/스킬 복사가 <strong className="text-foreground">자동으로 완료</strong>됩니다.
          </p>

          {!settings.repoPath ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm font-medium text-amber-400 mb-2">먼저 설정이 필요합니다</p>
              <p className="text-xs text-muted-foreground mb-3">
                상단 <strong>설정</strong> 버튼에서 harness-100 레포를 클론한 경로를 입력해주세요.
                아직 클론하지 않았다면:
              </p>
              <pre className="rounded bg-background p-2 text-xs font-mono text-muted-foreground">
                git clone https://github.com/revfactory/harness-100.git
              </pre>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 프로젝트 경로 입력 + 적용 버튼 */}
              <div className="flex gap-2">
                <Input
                  placeholder="프로젝트 경로 (예: C:/AI/my-travel)"
                  value={projectPath}
                  onChange={(e) => {
                    setProjectPath(e.target.value);
                    setApplyResult(null);
                  }}
                  className="flex-1"
                  disabled={applying}
                />
                <Button
                  onClick={handleApply}
                  disabled={applying || !projectPath}
                  className="shrink-0 gap-2 min-w-[100px]"
                >
                  {applying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      적용 중...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4" />
                      적용
                    </>
                  )}
                </Button>
              </div>

              {/* 이전에 적용된 경로 안내 */}
              {!applyResult && lastPath && (
                <div className="rounded-lg p-4 flex items-start gap-3 border border-green-500/30 bg-green-500/5">
                  <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-400">이전에 이 경로에 적용됨</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      경로를 변경하고 다시 적용하거나, 아래에서 바로 실행할 수 있습니다.
                    </p>
                  </div>
                </div>
              )}

              {/* 결과 메시지 */}
              {applyResult && (
                <div
                  className={`rounded-lg p-4 flex items-start gap-3 ${
                    applyResult.success
                      ? "border border-green-500/30 bg-green-500/5"
                      : "border border-red-500/30 bg-red-500/5"
                  }`}
                >
                  {applyResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${applyResult.success ? "text-green-400" : "text-red-400"}`}>
                      {applyResult.success ? "적용 완료!" : "적용 실패"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{applyResult.message}</p>
                  </div>
                </div>
              )}

              {/* 실행 패널 + 산출물 뷰어: 적용 성공 또는 이전 적용 이력이 있을 때 표시 */}
              {(applyResult?.success || lastPath) && projectPath && (
                <div className="space-y-4">
                  <ExecutionPanel
                    projectPath={projectPath}
                    agentCount={harness.agentCount}
                    harnessNumber={String(harness.number).padStart(2, "0")}
                    onOpenClaude={handleOpenClaude}
                  />
                  <ArtifactGenerator
                    projectPath={projectPath}
                    harnessNumber={harness.number}
                    category={harness.category}
                  />
                  <WorkspaceViewer projectPath={projectPath} />
                </div>
              )}

              {/* 미리보기: 어떤 파일이 복사되는지 */}
              {!applyResult && !lastPath && (
                <div className="rounded-lg bg-background/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">적용 시 생성되는 구조:</p>
                  <pre className="text-xs font-mono text-muted-foreground leading-relaxed">
{`${projectPath || "프로젝트"}/
└── .claude/
    ├── CLAUDE.md
    ├── agents/  (${harness.agentCount}개 에이전트)
    └── skills/  (${harness.skillCount}개 스킬)`}
                  </pre>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Agents */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Bot className="h-5 w-5" />
          에이전트 ({harness.agents.length})
        </h2>
        <div className="space-y-3">
          {harness.agents.map((agent) => (
            <Card key={agent.id} className="border-border/50">
              <CardContent className="p-0">
                <button
                  onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/50 transition-colors rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10 text-blue-400 text-sm font-bold">
                      {agent.id.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{agent.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{agent.description}</p>
                    </div>
                  </div>
                  {expandedAgent === agent.id ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {expandedAgent === agent.id && (
                  <div className="border-t border-border/50 p-4">
                    <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans leading-relaxed max-h-96 overflow-y-auto">
                      {agent.content}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* Skills */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Puzzle className="h-5 w-5" />
          스킬 ({harness.skills.length})
        </h2>

        {orchestrator && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">오케스트레이터</h3>
            <SkillCard
              skill={orchestrator}
              expanded={expandedSkill === orchestrator.id}
              onToggle={() => setExpandedSkill(expandedSkill === orchestrator.id ? null : orchestrator.id)}
            />
          </div>
        )}

        {specializedSkills.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">에이전트 확장 스킬</h3>
            <div className="space-y-3">
              {specializedSkills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  expanded={expandedSkill === skill.id}
                  onToggle={() => setExpandedSkill(expandedSkill === skill.id ? null : skill.id)}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <Separator />

      {/* Outputs */}
      {harness.outputs.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            산출물
          </h2>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="space-y-1">
                {harness.outputs.map((output, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    {output}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function SkillCard({
  skill,
  expanded,
  onToggle,
}: {
  skill: { id: string; name: string; description: string; type: string; content: string };
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-0">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/50 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold ${
                skill.type === "orchestrator"
                  ? "bg-purple-500/10 text-purple-400"
                  : "bg-emerald-500/10 text-emerald-400"
              }`}
            >
              {skill.type === "orchestrator" ? "O" : "S"}
            </div>
            <div>
              <p className="font-medium text-sm">{skill.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{skill.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px]">
              {skill.type === "orchestrator" ? "오케스트레이터" : "확장"}
            </Badge>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>
        {expanded && (
          <div className="border-t border-border/50 p-4">
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans leading-relaxed max-h-96 overflow-y-auto">
              {skill.content}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
