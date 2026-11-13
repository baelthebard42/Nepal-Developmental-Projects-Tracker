"use client";
// Everything that defines a view lives in the URL (plan §6.4) so links reproduce the exact view.
import { parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { FLOW_TYPES, STATUSES } from "@/lib/data/types";
import type { Filters } from "@/lib/analytics/aggregate";

export const METRICS = ["committed", "disbursed", "count"] as const;
export type Metric = (typeof METRICS)[number];
export const TABS = ["partners", "locations", "sectors"] as const;

export const viewParsers = {
  area: parseAsString, // selected area code (null = all Nepal)
  year: parseAsInteger,
  partners: parseAsArrayOf(parseAsString, ",").withDefault([]),
  sectors: parseAsArrayOf(parseAsString, ",").withDefault([]),
  status: parseAsArrayOf(parseAsStringLiteral(STATUSES), ",").withDefault([]),
  flow: parseAsArrayOf(parseAsStringLiteral(FLOW_TYPES), ",").withDefault([]),
  metric: parseAsStringLiteral(METRICS).withDefault("committed"),
  view: parseAsStringLiteral(["overview", "projects"] as const).withDefault("overview"),
  mode: parseAsStringLiteral(["2d", "3d"] as const).withDefault("2d"),
  level: parseAsStringLiteral(["province", "district"] as const).withDefault("province"), // national colouring level
  tab: parseAsStringLiteral(TABS).withDefault("partners"),
  project: parseAsString, // open drawer
  cur: parseAsStringLiteral(["USD", "NPR"] as const).withDefault("USD"),
};

export function useViewState() {
  return useQueryStates(viewParsers, { history: "replace", scroll: false });
}

export type ViewState = ReturnType<typeof useViewState>[0];

export function filtersOf(v: ViewState): Filters {
  return { year: v.year, partners: v.partners, sectors: v.sectors, status: v.status, flow: v.flow, areas: [] };
}

export const activeFilterCount = (v: ViewState) =>
  v.partners.length + v.sectors.length + v.status.length + v.flow.length + (v.year ? 1 : 0);
