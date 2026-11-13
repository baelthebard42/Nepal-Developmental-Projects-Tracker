"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { useData, useLocalName } from "@/components/providers";
import { useA } from "@/components/map/analytics-context";
import { Meter, PartnerBadge, Segmented, StatusPill } from "@/components/ui/bits";
import { useUI } from "@/lib/state/ui-store";
import { useViewState } from "@/lib/state/url-state";
import { useMoney } from "@/lib/hooks/use-money";
import type { ProjectView } from "@/lib/analytics/aggregate";
import { cn } from "@/lib/utils";

export function ProjectCard({ v }: { v: ProjectView }) {
  const t = useTranslations();
  const name = useLocalName();
  const { partners, areas, sectors } = useData();
  const money = useMoney();
  const [view, setView] = useViewState();
  const hover = useUI((s) => s.hoverProject);
  const p = v.project;
  const where = p.locations.length ? p.locations.map((l) => areas?.get(l.area_code)?.short ?? "").filter(Boolean).slice(0, 3).join(", ") : t("project.nationwide");
  return (
    <button
      onClick={() => setView({ project: p.id })}
      onMouseEnter={() => useUI.getState().set({ hoverProject: p.id })}
      onMouseLeave={() => useUI.getState().set({ hoverProject: null })}
      className={cn(
        "w-full rounded-xl border p-3.5 text-left transition-colors",
        view.project === p.id ? "border-teal bg-panel" : hover === p.id ? "border-muted bg-panel/80" : "border-line/70 bg-panel/50 hover:bg-panel/80",
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex -space-x-1">
          {v.funding.map((f) => <PartnerBadge key={f.partner_id} partner={partners.get(f.partner_id)} size={20} />)}
        </div>
        <span className="truncate text-xs font-semibold text-muted">{name(sectors.get(p.sector_code))}</span>
        <StatusPill status={p.status} className="ml-auto shrink-0" />
      </div>
      <div className="mt-2 font-semibold leading-snug">{name(p)}</div>
      <div className="mt-1 truncate text-xs text-muted">{where}</div>
      <div className="mt-2.5 flex items-center justify-between text-xs">
        <span><span className="text-muted">{t("totals.disbursed")}</span> <b className="tabular text-teal">{money(v.disbursed)}</b></span>
        <span><span className="text-muted">{t("totals.committed")}</span> <b className="tabular">{money(v.committed)}</b></span>
      </div>
      <Meter className="mt-1.5" value={v.committed ? v.disbursed / v.committed : 0} />
    </button>
  );
}

export function ProjectList() {
  const t = useTranslations();
  const a = useA();
  const [, setView] = useViewState();
  const [sort, setSort] = useState<"committed" | "recent" | "progress">("committed");
  const list = [...a.projects].sort((x, y) =>
    sort === "committed" ? y.committed - x.committed : sort === "recent" ? y.project.start_date.localeCompare(x.project.start_date) : y.project.progress_pct - x.project.progress_pct,
  );
  return (
    <div className="border-t border-line/70 pt-3.5">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setView({ view: "overview", project: null })} className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal hover:underline">
          <ArrowLeft className="size-3.5" /> {t("projects.hide")}
        </button>
        <Segmented
          label={t("projects.sortBy")}
          value={sort}
          onChange={setSort}
          size="sm"
          options={[{ value: "committed", label: t("projects.sortCommitted") }, { value: "recent", label: t("projects.sortRecent") }, { value: "progress", label: t("projects.sortProgress") }]}
        />
      </div>
      <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-muted">{t("projects.count", { count: list.length })}</div>
      {list.length === 0 && <p className="py-6 text-center text-sm text-muted">{t("breakdown.empty")}</p>}
      <ul className="mt-2 space-y-2">
        {list.map((v) => (
          <li key={v.project.id}><ProjectCard v={v} /></li>
        ))}
      </ul>
    </div>
  );
}
