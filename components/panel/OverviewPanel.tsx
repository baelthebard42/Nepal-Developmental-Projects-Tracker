"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { animate, useReducedMotion } from "motion/react";
import { ArrowLeft, ChevronDown, LayoutList, TrendingDown, TrendingUp, X } from "lucide-react";
import { useData, useLocalName } from "@/components/providers";
import { useA } from "@/components/map/analytics-context";
import { Meter, PartnerBadge, SampleBadge } from "@/components/ui/bits";
import { ProjectList } from "@/components/projects/ProjectList";
import { useUI } from "@/lib/state/ui-store";
import { TABS, useViewState } from "@/lib/state/url-state";
import { useMoney } from "@/lib/hooks/use-money";
import { splitMoney } from "@/lib/format/money";
import type { Row } from "@/lib/analytics/aggregate";
import { cn } from "@/lib/utils";

/** animated number (counts up/down when the value changes; respects reduced motion) */
function useTween(value: number) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce) {
      from.current = value;
      return;
    }
    const c = animate(from.current, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => { setV(x); from.current = x; } });
    return () => c.stop();
  }, [value, reduce]);
  return reduce ? value : v;
}

function BigMoney({ value, label, filled }: { value: number; label: string; filled?: boolean }) {
  const money = useMoney();
  const v = useTween(value);
  const m = splitMoney(money(v));
  return (
    <div className="relative z-10 text-center">
      <div className="whitespace-nowrap font-display leading-none">
        <span className="text-[15px] font-semibold">{m.unit} </span>
        <span className="text-[28px] font-bold tabular tracking-tight xl:text-[30px]">{m.value}</span>
        {m.suffix && <span className="text-[15px] font-semibold"> {m.suffix}</span>}
      </div>
      <div className={cn("mt-1 text-[11px] font-bold uppercase tracking-[0.12em]", filled ? "text-[#bff3f7]" : "text-teal")}>{label}</div>
    </div>
  );
}

function Counters() {
  const t = useTranslations();
  const a = useA();
  const tot = a.agg?.totals ?? { committed: 0, disbursed: 0, count: 0 };
  const count = Math.round(useTween(tot.count));
  const max = Math.max(tot.committed, 1);
  const rC = 62;
  const rD = Math.max(26, rC * Math.sqrt(tot.disbursed / max));
  return (
    <div id="counters" className="py-4">
      <div className="relative mx-auto flex h-[140px] max-w-[340px] items-center justify-center">
        <svg viewBox="0 0 340 140" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle cx={108} cy={70} r={rD} fill="var(--teal-dark)" className="transition-all duration-700" />
          <circle cx={226} cy={70} r={rC} fill="none" stroke="var(--teal)" strokeWidth={1.6} />
        </svg>
        <div className="grid w-full grid-cols-2">
          <BigMoney value={tot.disbursed} label={t("totals.disbursed")} filled />
          <BigMoney value={tot.committed} label={t("totals.committed")} />
        </div>
      </div>
      <div className="mt-2 text-center text-xs font-bold uppercase tracking-[0.14em] text-teal">{t("totals.projects", { count })}</div>
    </div>
  );
}

function FilterChips() {
  const t = useTranslations();
  const name = useLocalName();
  const { partners, sectors } = useData();
  const [view, setView] = useViewState();
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...view.partners.map((p) => ({ key: `p-${p}`, label: name(partners.get(p)) || p, clear: () => setView({ partners: view.partners.filter((x) => x !== p) }) })),
    ...view.sectors.map((s) => ({ key: `s-${s}`, label: name(sectors.get(s)) || s, clear: () => setView({ sectors: view.sectors.filter((x) => x !== s) }) })),
    ...view.status.map((s) => ({ key: `st-${s}`, label: t(`status.${s}`), clear: () => setView({ status: view.status.filter((x) => x !== s) }) })),
    ...view.flow.map((f) => ({ key: `f-${f}`, label: t(`flow.${f}`), clear: () => setView({ flow: view.flow.filter((x) => x !== f) }) })),
    ...(view.year ? [{ key: "y", label: String(view.year), clear: () => setView({ year: null }) }] : []),
  ];
  if (!chips.length) return null;
  return (
    <div className="border-t border-line/70 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{t("filters.filtered")}</span>
        <button onClick={() => setView({ partners: [], sectors: [], status: [], flow: [], year: null })} className="text-xs font-semibold text-teal hover:underline">
          {t("filters.clear")}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button key={c.key} onClick={c.clear} className="inline-flex items-center gap-1 rounded-full bg-teal/15 py-1 pl-2.5 pr-1.5 text-xs font-semibold text-teal hover:bg-teal/25">
            {c.label} <X className="size-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}

function TrendChart() {
  const t = useTranslations();
  const a = useA();
  const money = useMoney();
  const [view, setView] = useViewState();
  const [hover, setHover] = useState<number | null>(null);
  const data = a.agg?.byYear ?? [];
  if (!data.length) return null;
  const max = Math.max(1, ...data.map((d) => d.disbursed));
  const shown = data.find((d) => d.year === (hover ?? view.year));
  return (
    <div className="border-t border-line/70 py-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{t("trend.title")}</span>
        <span className="text-xs tabular text-text">{shown ? `${shown.year}: ${money(shown.disbursed)}` : <span className="text-muted">{t("trend.hint")}</span>}</span>
      </div>
      <div className="mt-2 flex h-16 items-end gap-[3px]" role="group" aria-label={t("trend.title")}>
        {data.map((d) => {
          const sel = view.year === d.year;
          return (
            <button
              key={d.year}
              title={`${d.year}: ${money(d.disbursed)}`}
              aria-label={`${d.year}: ${money(d.disbursed)}`}
              aria-pressed={sel}
              onMouseEnter={() => setHover(d.year)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setView({ year: sel ? null : d.year })}
              className="group flex h-full flex-1 flex-col justify-end"
            >
              <span
                className={cn("block w-full rounded-t-sm transition-all duration-500", sel ? "bg-teal" : view.year ? "bg-teal/30 group-hover:bg-teal/60" : "bg-teal/60 group-hover:bg-teal")}
                style={{ height: `${Math.max(2, (d.disbursed / max) * 100)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular text-muted">
        <span>{data[0].year}</span>
        <span>{data[data.length - 1].year}</span>
      </div>
    </div>
  );
}

function TrendIcon({ trend }: { trend: number }) {
  const t = useTranslations("breakdown");
  if (trend > 0) return <TrendingUp className="size-3.5 text-completed" aria-label={t("trendUp")} />;
  if (trend < 0) return <TrendingDown className="size-3.5 text-suspended" aria-label={t("trendDown")} />;
  return <span className="inline-block size-3.5" />;
}

function Breakdown() {
  const t = useTranslations();
  const name = useLocalName();
  const { partners, sectors, areas } = useData();
  const a = useA();
  const money = useMoney();
  const [view, setView] = useViewState();
  const ui = useUI();
  const [expanded, setExpanded] = useState(false);
  const tab = view.tab;
  const rows: Row[] = !a.agg ? [] : tab === "partners" ? a.agg.partners : tab === "sectors" ? a.agg.sectors : a.agg.locations;
  const metricOf = (r: Row) => (view.metric === "count" ? r.count : view.metric === "disbursed" ? r.disbursed : r.committed);
  const total = rows.reduce((s, r) => s + metricOf(r), 0) + (tab === "locations" && a.agg ? (view.metric === "count" ? 0 : metricOf({ ...a.agg.unallocated, key: "", trend: 0 })) : 0);
  const sorted = [...rows].filter((r) => r.count > 0 || tab === "locations").sort((x, y) => metricOf(y) - metricOf(x));
  const visible = expanded ? sorted : sorted.slice(0, 8);
  const childLevel = a.childLevel;

  const label = (r: Row) =>
    tab === "partners" ? name(partners.get(r.key)) : tab === "sectors" ? name(sectors.get(r.key)) : (() => {
      const ar = areas?.get(r.key);
      return ar ? (ar.level === "province" ? name(ar) : ar.level === "palika" ? name(ar) : ar.short) : r.key;
    })();

  const onEnter = (r: Row) => ui.set(tab === "partners" ? { hoverPartner: r.key } : tab === "sectors" ? { hoverSector: r.key } : { hoverArea: r.key, hoverPoint: null });
  const onLeave = () => ui.set({ hoverPartner: null, hoverSector: null, hoverArea: null });
  const onClick = (r: Row) => {
    onLeave();
    if (tab === "partners") setView({ partners: view.partners.includes(r.key) ? view.partners.filter((x) => x !== r.key) : [...view.partners, r.key] });
    else if (tab === "sectors") setView({ sectors: view.sectors.includes(r.key) ? view.sectors.filter((x) => x !== r.key) : [...view.sectors, r.key] });
    else setView({ area: r.key });
  };
  const selected = (r: Row) => (tab === "partners" ? view.partners.includes(r.key) : tab === "sectors" ? view.sectors.includes(r.key) : view.area === r.key);
  const tabLabel = (k: (typeof TABS)[number]) => (k === "locations" ? t(`levels.${childLevel}s`) : t(`breakdown.${k}`));

  return (
    <div id="breakdown" className="border-t border-line/70 pt-3.5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{t("breakdown.title")}</div>
      <div role="tablist" className="mt-1.5 flex gap-5 border-b border-line">
        {TABS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => { setView({ tab: k }); setExpanded(false); }}
            className={cn("-mb-px border-b-[3px] pb-2 font-display text-[17px] font-semibold transition-colors", tab === k ? "border-muted text-text" : "border-transparent text-[#c5d2dc] hover:text-text")}
          >
            {tabLabel(k)}
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-[10.5px] font-bold uppercase tracking-wider text-muted">
        <span>{view.metric === "count" ? t("metric.count") : t(`metric.${view.metric}`)}</span>
        <span>{t("breakdown.share")}</span>
      </div>
      {sorted.length === 0 && <p className="py-6 text-center text-sm text-muted">{t("breakdown.empty")}</p>}
      <ul className="mt-1">
        {visible.map((r) => {
          const v = metricOf(r);
          const share = total ? v / total : 0;
          const sel = selected(r);
          return (
            <li key={r.key}>
              <button
                onMouseEnter={() => onEnter(r)}
                onMouseLeave={onLeave}
                onFocus={() => onEnter(r)}
                onBlur={onLeave}
                onClick={() => onClick(r)}
                className={cn("group w-full rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-panel/70", sel && "bg-panel")}
              >
                <div className="flex items-center gap-2">
                  {tab === "partners" && <PartnerBadge partner={partners.get(r.key)} size={18} />}
                  <span className={cn("truncate text-[15px] font-semibold", sel && "text-teal")}>{label(r)}</span>
                  <TrendIcon trend={r.trend} />
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <Meter value={share} className="flex-1" height={4} />
                  <span className="w-[92px] text-right text-xs font-semibold tabular">{view.metric === "count" ? r.count : money(v)}</span>
                  <span className="w-9 text-right text-xs tabular text-muted">{Math.round(share * 100)}%</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {sorted.length > 8 && (
        <button onClick={() => setExpanded((e) => !e)} className="mt-1 flex w-full items-center justify-center gap-1 py-2 text-xs font-bold uppercase tracking-wider text-teal">
          {expanded ? "−" : t("common.more", { count: sorted.length - 8 })} <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
      )}
      {tab === "locations" && a.agg && a.agg.unallocated.count > 0 && (
        <p className="mt-2 rounded-lg bg-panel/60 px-3 py-2 text-xs text-muted">
          {t("breakdown.unallocated")}: <b className="text-text">{money(a.agg.unallocated.committed)}</b> · {t("projects.count", { count: a.agg.unallocated.count })}
        </p>
      )}
    </div>
  );
}

function ScopeHeader() {
  const t = useTranslations();
  const name = useLocalName();
  const { areas, dataset } = useData();
  const a = useA();
  const [, setView] = useViewState();
  const isSample = dataset.projects.some((p) => p.is_sample);
  if (!a.scopeArea)
    return (
      <div className="pb-3 pt-4">
        <p className="text-[15px] leading-relaxed text-[#d5e0e8]">{t("app.intro")}</p>
        {isSample && <SampleBadge className="mt-3 md:hidden" />}
      </div>
    );
  const parent = areas?.get(a.scopeArea.parent);
  return (
    <div className="pb-2 pt-4">
      <button onClick={() => setView({ area: a.scopeArea!.parent, project: null })} className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal hover:underline">
        <ArrowLeft className="size-3.5" /> {t("scope.back", { name: parent ? (parent.level === "province" ? name(parent) : parent.short) : t("scope.nepal") })}
      </button>
      <div className="mt-2 text-[11px] font-bold uppercase tracking-wider text-muted">{t(`levels.${a.scopeArea.level}`)}</div>
      <h1 className="font-display text-2xl font-bold leading-tight">{name(a.scopeArea)}</h1>
    </div>
  );
}

export function OverviewPanel() {
  const t = useTranslations();
  const a = useA();
  const [view, setView] = useViewState();
  return (
    <div className="px-4 pb-6 sm:px-5">
      <ScopeHeader />
      <div className="border-t border-line/70">
        <Counters />
      </div>
      <FilterChips />
      {view.view === "projects" ? (
        <ProjectList />
      ) : (
        <>
          <TrendChart />
          <Breakdown />
          <button
            onClick={() => setView({ view: "projects" })}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-teal/60 py-2.5 text-sm font-bold text-teal hover:bg-teal/10"
          >
            <LayoutList className="size-4" /> {t("projects.show")} ({a.projects.length})
          </button>
        </>
      )}
    </div>
  );
}
