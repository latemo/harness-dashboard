"use client";

import Link from "next/link";
import { Heart, ArrowLeft, Bot, Puzzle, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFavorites } from "@/hooks/useFavorites";
import { CATEGORIES } from "@/lib/categories";
import allHarnesses from "@/data/harnesses.json";
import { HarnessSummary } from "@/lib/types";

export default function FavoritesPage() {
  const { favorites, toggle } = useFavorites();

  const favHarnesses = (allHarnesses as HarnessSummary[]).filter((h) => favorites.includes(h.id));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />
          카탈로그로 돌아가기
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Heart className="h-6 w-6 text-red-400" />
          즐겨찾기 ({favHarnesses.length})
        </h1>
      </div>

      {favHarnesses.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <Heart className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">즐겨찾기한 하네스가 없습니다</p>
          <p className="text-sm mt-1">카탈로그에서 하트 아이콘을 눌러 추가해보세요</p>
          <Link href="/" className="inline-flex items-center gap-1 mt-4 text-sm text-primary hover:underline">
            카탈로그 보기 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favHarnesses.map((h) => {
            const cat = CATEGORIES.find((c) => c.id === h.category)!;
            return (
              <Card key={h.id} className="group border-border/50 transition-all hover:border-border hover:shadow-lg">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className={`text-[10px] px-2 py-0 ${cat.color}`}>
                      {cat.icon} {cat.label}
                    </Badge>
                    <button onClick={() => toggle(h.id)} className="text-red-400">
                      <Heart className="h-4 w-4 fill-red-400" />
                    </button>
                  </div>
                  <Link href={`/harness/${h.id}`}>
                    <h3 className="mt-3 text-base font-semibold group-hover:text-primary transition-colors">{h.title}</h3>
                  </Link>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{h.description}</p>
                  <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Bot className="h-3.5 w-3.5" />{h.agentCount}명</span>
                    <span className="flex items-center gap-1"><Puzzle className="h-3.5 w-3.5" />{h.skillCount}개</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
