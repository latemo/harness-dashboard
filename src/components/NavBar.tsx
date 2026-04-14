"use client";

import Link from "next/link";
import { LayoutGrid, Heart, History, Link2, ExternalLink } from "lucide-react";
import SettingsDialog from "./SettingsDialog";

export default function NavBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            H
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Harness Hub</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">Agent Team Dashboard</p>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">카탈로그</span>
          </Link>
          <Link
            href="/favorites"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">즐겨찾기</span>
          </Link>
          <Link
            href="/history"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">이력</span>
          </Link>
          <Link
            href="/chain"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">체인</span>
          </Link>
          <SettingsDialog />
          <a
            href="https://github.com/revfactory/harness-100"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </nav>
      </div>
    </header>
  );
}
