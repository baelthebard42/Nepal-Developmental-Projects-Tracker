"use client";
import { useTranslations } from "next-intl";
import { Maximize, Minus, Plus } from "lucide-react";
import { Segmented } from "@/components/ui/bits";
import { RAMP } from "@/components/map/NepalMap.colors";
import { useA } from "@/components/map/analytics-context";
import { useViewState, type Metric } from "@/lib/state/url-state";
import { useMoney } from "@/lib/hooks/use-money";
import { cn } from "@/lib/utils";

export function MapControls({ className }: { className?: string }) {
  const t = useTranslations();
  const [view, setView] = useViewState();
  const a = useA();
  const btn = "grid size-9 place-items-center text-text hover:bg-panel-2";
  return (
    <div id="map-controls" className={cn("flex flex-col items-end gap-2", className)}>
      {!a.focus && (
        <Segmented
          label={t("map.show")}
          value={view.level}
          onChange={(level) => setView({ level })}
          options={[{ value: "province", label: t("levels.provinces") }, { value: "district", label: t("levels.districts") }]}
          size="sm"
          className="bg-bg/90 shadow-lg"
        />
      )}
      <Segmented
        label="2D / 3D"
        value={view.mode}
        onChange={(mode) => setView({ mode })}
        options={[{ value: "2d", label: t("map.mode2d") }, { value: "3d", label: t("map.mode3d") }]}
        size="sm"
        className="bg-bg/90 shadow-lg"
      />
      <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-bg/90 shadow-lg">
        <button className={btn} aria-label={t("map.zoomIn")} title={t("map.zoomIn")} onClick={() => window.dispatchEvent(new Event("map-zoom-in"))}>
          <Plus className="size-4" />
        </button>
        <button className={cn(btn, "border-y border-line")} aria-label={t("map.zoomOut")} title={t("map.zoomOut")} onClick={() => window.dispatchEvent(new Event("map-zoom-out"))}>
          <Minus className="size-4" />
        </button>
        <button className={btn} aria-label={t("map.reset")} title={t("map.reset")} onClick={() => window.dispatchEvent(new Event("map-refit"))}>
          <Maximize className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Lowy-style bottom-left block: period, metric picker, colour legend */
export function MetricLegend({ className }: { className?: string }) {
  const t = useTranslations();
  const [view, setView] = useViewState();
  const a = useA();
  const money = useMoney();
  const max = a.agg ? Math.max(0, ...a.agg.locations.map((r) => (view.metric === "count" ? r.count : view.metric === "disbursed" ? r.disbursed : r.committed))) : 0;
  const period = view.year ? String(view.year) : a.yearRange ? `${a.yearRange[0]}–${String(a.yearRange[1]).slice(2)}` : "";

  return (
    <div id="metric-legend" className={cn("max-w-[calc(100%-7rem)] rounded-xl bg-bg/85 p-3 shadow-lg backdrop-blur", className)}>
      <div className="font-display text-xl font-semibold tracking-wide sm:text-2xl">{period}</div>
      <div role="radiogroup" aria-label={t("metric.label")} className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {(["committed", "disbursed", "count"] as Metric[]).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={view.metric === m}
            onClick={() => setView({ metric: m })}
            className={cn("flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider", view.metric === m ? "text-text" : "text-muted hover:text-text")}
          >
            <span className={cn("grid size-3.5 place-items-center rounded-full border-2", view.metric === m ? "border-teal" : "border-muted")}>
              {view.metric === m && <span className="size-1.5 rounded-full bg-teal" />}
            </span>
            {t(`metric.${m}`)}
          </button>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-4 rounded-sm" style={{ background: "#3a4c5d" }} /> {t("map.legendNone")}
        </span>
        <span className="ml-1">{t("map.legendLow")}</span>
        <span className="flex h-2.5 w-24 overflow-hidden rounded-sm sm:w-32">
          {RAMP.map((c) => (
            <span key={c} className="flex-1" style={{ background: c }} />
          ))}
        </span>
        <span>{max ? (view.metric === "count" ? max : money(max)) : t("map.legendHigh")}</span>
      </div>
    </div>
  );
}
