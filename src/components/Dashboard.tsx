"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Users, Puzzle, FileText, Heart, Bot, ArrowRight, CheckCircle2, FolderOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HarnessSummary } from "@/lib/types";
import { CATEGORIES, CategoryInfo } from "@/lib/categories";
import { useFavorites } from "@/hooks/useFavorites";
import { useHistory } from "@/hooks/useHistory";

interface DashboardProps {
  harnesses: HarnessSummary[];
  stats: { totalHarnesses: number; totalAgents: number; totalSkills: number; totalFiles: number };
}

export default function Dashboard({ harnesses, stats }: DashboardProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { toggle, isFavorite } = useFavorites();
  const { getAppliedInfo } = useHistory();

  const filtered = useMemo(() => {
    let list = harnesses;
    if (selectedCategory) {
      list = list.filter((h) => h.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q) ||
          h.name.toLowerCase().includes(q) ||
          h.agentNames.some((a) => a.toLowerCase().includes(q)) ||
          h.categoryLabel.includes(q)
      );
    }
    return list;
  }, [harnesses, search, selectedCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of harnesses) {
      counts[h.category] = (counts[h.category] || 0) + 1;
    }
    return counts;
  }, [harnesses]);

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={<FileText className="h-5 w-5" />} label="하네스" value={stats.totalHarnesses} />
        <StatCard icon={<Bot className="h-5 w-5" />} label="에이전트" value={stats.totalAgents} />
        <StatCard icon={<Puzzle className="h-5 w-5" />} label="스킬" value={stats.totalSkills} />
        <StatCard icon={<Users className="h-5 w-5" />} label="총 파일" value={stats.totalFiles} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="하네스 검색... (이름, 설명, 에이전트, 키워드)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 text-base"
        />
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors border ${
            !selectedCategory
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-transparent text-muted-foreground border-border hover:bg-accent"
          }`}
        >
          전체 ({harnesses.length})
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors border ${
              selectedCategory === cat.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-muted-foreground border-border hover:bg-accent"
            }`}
          >
            {cat.icon} {cat.label} ({categoryCounts[cat.id] || 0})
          </button>
        ))}
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filtered.length}개 하네스 표시 중
      </div>

      {/* Harness Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((h) => (
          <HarnessCard
            key={h.id}
            harness={h}
            category={CATEGORIES.find((c) => c.id === h.category)!}
            isFav={isFavorite(h.id)}
            onToggleFav={() => toggle(h.id)}
            appliedInfo={getAppliedInfo(h.id)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-20 text-center text-muted-foreground">
          <p className="text-lg">검색 결과가 없습니다</p>
          <p className="text-sm mt-1">다른 키워드로 검색해보세요</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="border-border/50">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold">{value.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function HarnessCard({
  harness,
  category,
  isFav,
  onToggleFav,
  appliedInfo,
}: {
  harness: HarnessSummary;
  category: CategoryInfo;
  isFav: boolean;
  onToggleFav: () => void;
  appliedInfo: { path: string; date: string } | null;
}) {
  return (
    <Card className={`group relative transition-all hover:border-border hover:shadow-lg ${
      appliedInfo ? "border-green-500/30" : "border-border/50"
    }`}>
      <CardContent className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">#{String(harness.number).padStart(2, "0")}</span>
            <Badge variant="outline" className={`text-[10px] px-2 py-0 ${category.color}`}>
              {category.icon} {category.label}
            </Badge>
            {appliedInfo && (
              <Badge variant="outline" className="text-[10px] px-2 py-0 bg-green-500/10 text-green-400 border-green-500/20">
                <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                적용됨
              </Badge>
            )}
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              onToggleFav();
            }}
            className="text-muted-foreground transition-colors hover:text-red-400"
          >
            <Heart className={`h-4 w-4 ${isFav ? "fill-red-400 text-red-400" : ""}`} />
          </button>
        </div>

        {/* Title */}
        <Link href={`/harness/${harness.id}`}>
          <h3 className="mt-3 text-base font-semibold leading-tight group-hover:text-primary transition-colors">
            {harness.title}
          </h3>
        </Link>

        {/* Description */}
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-relaxed">{harness.description}</p>

        {/* Applied path */}
        {appliedInfo && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-green-400/80 font-mono truncate">
            <FolderOpen className="h-3 w-3 shrink-0" />
            <span className="truncate">{appliedInfo.path}</span>
          </div>
        )}

        {/* Meta */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Bot className="h-3.5 w-3.5" />
              {harness.agentCount}명
            </span>
            <span className="flex items-center gap-1">
              <Puzzle className="h-3.5 w-3.5" />
              {harness.skillCount}개
            </span>
          </div>
          <Link
            href={`/harness/${harness.id}`}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            상세보기
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
