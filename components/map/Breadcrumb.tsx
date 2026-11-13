"use client";
import { useTranslations } from "next-intl";
import { ChevronRight, Home } from "lucide-react";
import { useData, useLocalName } from "@/components/providers";
import { useViewState } from "@/lib/state/url-state";
import { cn } from "@/lib/utils";

export function Breadcrumb({ className }: { className?: string }) {
  const t = useTranslations();
  const name = useLocalName();
  const { areas } = useData();
  const [view, setView] = useViewState();
  const path = areas?.path(view.area) ?? [];

  const crumb = "rounded-md px-2 py-1 text-sm font-semibold transition-colors";
  return (
    <nav id="breadcrumb" aria-label="Location" className={cn("flex min-w-0 flex-wrap items-center gap-0.5 rounded-lg bg-bg/90 p-1 shadow-lg backdrop-blur", className)}>
      <button onClick={() => setView({ area: null, project: null })} className={cn(crumb, "inline-flex items-center gap-1.5", path.length ? "text-muted hover:text-text" : "text-text")}>
        <Home className="size-3.5" /> {t("scope.nepal")}
      </button>
      {path.map((a, i) => (
        <span key={a.code} className="flex min-w-0 items-center">
          <ChevronRight className="size-3.5 shrink-0 text-muted" />
          <button
            onClick={() => setView({ area: a.code, project: null })}
            className={cn(crumb, "truncate", i === path.length - 1 ? "text-teal" : "text-muted hover:text-text")}
            title={name(a)}
          >
            {a.level === "province" ? name(a) : a.short}
          </button>
        </span>
      ))}
    </nav>
  );
}
