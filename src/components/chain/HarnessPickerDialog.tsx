"use client";

import { useState, useMemo } from "react";
import { Search, Bot, Puzzle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { HarnessSummary } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (harness: HarnessSummary) => void;
  harnesses: HarnessSummary[];
  excludeIds?: string[];
}

export default function HarnessPickerDialog({ open, onClose, onSelect, harnesses, excludeIds = [] }: Props) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = harnesses.filter((h) => !excludeIds.includes(h.id));
    if (selectedCategory) {
      list = list.filter((h) => h.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q) ||
          h.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [harnesses, search, selectedCategory, excludeIds]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>하네스 선택</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="하네스 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
              !selectedCategory
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-muted-foreground border-border hover:bg-accent"
            }`}
          >
            전체
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:bg-accent"
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {filtered.map((h) => {
            const cat = CATEGORIES.find((c) => c.id === h.category);
            return (
              <button
                key={h.id}
                onClick={() => {
                  onSelect(h);
                  onClose();
                  setSearch("");
                  setSelectedCategory(null);
                }}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-accent/50 transition-colors group"
              >
                <span className="text-xs font-mono text-muted-foreground w-7 shrink-0">
                  #{String(h.number).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium group-hover:text-primary transition-colors">
                      {h.title}
                    </span>
                    {cat && (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cat.color}`}>
                        {cat.icon} {cat.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{h.description}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                  <span className="flex items-center gap-0.5">
                    <Bot className="h-3 w-3" />
                    {h.agentCount}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Puzzle className="h-3 w-3" />
                    {h.skillCount}
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-10 text-center text-muted-foreground text-sm">
              검색 결과가 없습니다
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
