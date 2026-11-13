"use client";
import { useTranslations } from "next-intl";
import { CircleHelp, ListFilter } from "lucide-react";
import { useA } from "@/components/map/analytics-context";
import { useUI } from "@/lib/state/ui-store";
import { activeFilterCount, useViewState } from "@/lib/state/url-state";
import { cn } from "@/lib/utils";

/** Lowy-style right rail: Filter, Year list, Tour */
export function RightRail({ className }: { className?: string }) {
  const t = useTranslations();
  const [view, setView] = useViewState();
  const a = useA();
  const openFilters = () => useUI.getState().set({ filtersOpen: true });
  const n = activeFilterCount(view) - (view.year ? 1 : 0);
  const years: number[] = [];
  if (a.yearRange) for (let y = a.yearRange[0]; y <= a.yearRange[1]; y++) years.push(y);

  return (
    <div className={cn("w-[72px] shrink-0 flex-col items-center py-3", className)}>
      <button id="filter-button" onClick={openFilters} className="relative flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-text hover:text-teal">
        {t("nav.filter")}
        <ListFilter className="size-5" />
        {n > 0 && <span className="absolute -right-0.5 top-0 grid size-4 place-items-center rounded-full bg-teal text-[10px] text-[#0f1a22]">{n}</span>}
      </button>

      <div id="year-list" className="mt-5 flex min-h-0 flex-1 flex-col items-center overflow-y-auto">
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">{t("nav.year")}</div>
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setView({ year: view.year === y ? null : y })}
            className={cn(
              "w-full rounded-md py-[3px] text-[13px] font-semibold tabular transition-colors",
              view.year === y ? "bg-teal text-[#0f1a22]" : "text-[#c5d2dc] hover:text-teal",
            )}
          >
            {y}
          </button>
        ))}
        <button
          onClick={() => setView({ year: null })}
          className={cn("mt-1 w-full rounded-md px-1 py-1 text-[11px] font-bold uppercase leading-tight tracking-wider", !view.year ? "text-teal" : "text-text hover:text-teal")}
        >
          {t("nav.allYears")}
        </button>
      </div>

      <button onClick={() => window.dispatchEvent(new Event("start-tour"))} className="mt-3 flex flex-col items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-text hover:text-teal">
        <CircleHelp className="size-5" /> {t("nav.tour")}
      </button>
    </div>
  );
}
