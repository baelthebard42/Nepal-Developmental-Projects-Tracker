"use client";
import { useMemo } from "react";
import { useData } from "@/components/providers";
import { aggregate, filterProjects, scopeShare, type Aggregate, type ProjectView } from "@/lib/analytics/aggregate";
import { filtersOf, useViewState } from "@/lib/state/url-state";
import type { Area, Level } from "@/lib/data/types";

export interface Analytics {
  agg: Aggregate | null;
  /** filtered projects that touch the current scope */
  projects: ProjectView[];
  scope: string | null;
  scopeArea: Area | undefined;
  /** the level coloured on the map and listed in the Locations tab */
  childLevel: Exclude<Level, "national">;
  /** area whose children are coloured (district for palika scope) */
  focus: string | null;
  yearRange: [number, number] | null;
  compareYear: number;
}

const CURRENT_YEAR = 2026;

export function useAnalytics(): Analytics {
  const { dataset, areas } = useData();
  const [view] = useViewState();
  const filters = filtersOf(view);
  const key = JSON.stringify(filters);

  return useMemo(() => {
    const scopeArea = areas?.get(view.area);
    const scope = scopeArea ? scopeArea.code : null;
    // palika scope: colour the palikas of its district, with this palika selected
    const focus = scopeArea?.level === "palika" ? scopeArea.parent : scope;
    const focusArea = areas?.get(focus);
    const childLevel: Analytics["childLevel"] = !focusArea ? view.level : focusArea.level === "province" ? "district" : "palika";
    const compareYear = view.year ?? CURRENT_YEAR - 1;
    if (!areas) return { agg: null, projects: [], scope, scopeArea, childLevel, focus, yearRange: null, compareYear };

    const views = filterProjects(dataset, filters, areas);
    const all = filterProjects(dataset, filters, areas, { ignoreYear: true });
    const childLevelAreas = !focusArea && view.level === "district" ? areas.areas.filter((a) => a.level === "district") : undefined;
    const agg = aggregate(views, all, focus, areas, { compareYear, childLevelAreas });
    if (scope !== focus) {
      // palika selected: totals/partners/sectors for the palika itself
      const own = aggregate(views, all, scope, areas, { compareYear });
      agg.totals = own.totals;
      agg.partners = own.partners;
      agg.sectors = own.sectors;
      agg.byYear = own.byYear;
    }
    const projects = views.filter((v) => scopeShare(v.project, scope, areas) > 0);
    const ys = dataset.projects.flatMap((p) => p.transactions.map((t) => Number(t.date.slice(0, 4))));
    const yearRange: [number, number] | null = ys.length ? [Math.min(...ys), Math.max(...ys)] : null;
    return { agg, projects, scope, scopeArea, childLevel, focus, yearRange, compareYear };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, areas, key, view.area, view.level]);
}
