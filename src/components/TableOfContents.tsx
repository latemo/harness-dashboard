"use client";

import { useState, useEffect, useCallback } from "react";
import type { Heading } from "./MarkdownRenderer";

interface TableOfContentsProps {
  headings: Heading[];
  containerRef?: React.RefObject<HTMLElement | null>;
}

export default function TableOfContents({ headings, containerRef }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        setActiveId(entry.target.id);
      }
    }
  }, []);

  useEffect(() => {
    const root = containerRef?.current || null;
    const observer = new IntersectionObserver(handleObserver, {
      root,
      rootMargin: "-20% 0px -60% 0px",
      threshold: 0,
    });

    for (const heading of headings) {
      const el = (root || document).querySelector(`#${CSS.escape(heading.id)}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings, containerRef, handleObserver]);

  const scrollTo = (id: string) => {
    const root = containerRef?.current || document.documentElement;
    const el = (containerRef?.current || document).querySelector(`#${CSS.escape(id)}`);
    if (!el) return;

    if (containerRef?.current) {
      const container = containerRef.current;
      const elTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top: elTop - 20, behavior: "smooth" });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (headings.length === 0) return null;

  return (
    <nav className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
        목차
      </p>
      {headings.map((heading, i) => (
        <button
          key={`${heading.id}-${i}`}
          onClick={() => scrollTo(heading.id)}
          className={`block w-full text-left text-xs py-1 transition-colors truncate ${
            activeId === heading.id
              ? "text-blue-400 font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
          title={heading.text}
        >
          {heading.text}
        </button>
      ))}
    </nav>
  );
}
