"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import Papa from "papaparse";
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Search, X } from "lucide-react";
import { useData, useLocalName } from "@/components/providers";
import { PartnerBadge, SampleBadge, StatusPill } from "@/components/ui/bits";
import { filterProjects } from "@/lib/analytics/aggregate";
import type { Partner, Status } from "@/lib/data/types";
import { formatInt } from "@/lib/format/money";
import { useMoney } from "@/lib/hooks/use-money";
import { activeFilterCount, filtersOf, useViewState } from "@/lib/state/url-state";
import { cn } from "@/lib/utils";

interface TableRow {
  id: string;
  title: string;
  sector: string;
  location: string;
  partners: Partner[];
  partnerNames: string;
  committed: number;
  disbursed: number;
  status: Status;
  statusLabel: string;
  progress: number;
}

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
});
const helper = createColumnHelper<typeof features, TableRow>();

export function ProjectTable() {
  const t = useTranslations();
  const name = useLocalName();
  const money = useMoney();
  const { dataset, partners, sectors, areas } = useData();
  const [view, setView] = useViewState();
  const [query, setQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "committed", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });

  const views = useMemo(() => {
    const f = filtersOf(view);
    if (view.area) f.areas = [view.area];
    return filterProjects(dataset, f, areas);
  }, [dataset, view, areas]);

  const allRows = useMemo<TableRow[]>(
    () =>
      views.map((v) => {
        const p = v.project;
        const ps = v.funding.map((f) => partners.get(f.partner_id)).filter((x): x is Partner => !!x);
        const loc = p.locations.length
          ? p.locations.map((l) => (areas?.get(l.area_code) ? name(areas.get(l.area_code)) : l.area_code)).join(", ")
          : t("project.nationwide");
        return {
          id: p.id,
          title: name(p),
          sector: name(sectors.get(p.sector_code)),
          location: loc,
          partners: ps,
          partnerNames: ps.map((x) => name(x)).join(", "),
          committed: v.committed,
          disbursed: v.disbursed,
          status: p.status,
          statusLabel: t(`status.${p.status}`),
          progress: p.progress_pct,
        };
      }),
    [views, partners, sectors, areas, name, t],
  );

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) => [r.title, r.sector, r.location, r.partnerNames, r.id].some((s) => s.toLowerCase().includes(q)));
  }, [allRows, query]);

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("title", {
          header: t("data.title_col"),
          sortFn: "text",
          cell: (info) => (
            <Link href={`/projects/${info.row.original.id}`} className="font-semibold text-l-text hover:text-l-teal hover:underline">
              {info.getValue()}
            </Link>
          ),
        }),
        helper.accessor("sector", { header: t("data.sector"), sortFn: "text" }),
        helper.accessor("location", { header: t("data.location"), sortFn: "text", cell: (info) => <span className="line-clamp-2">{info.getValue()}</span> }),
        helper.accessor("partnerNames", {
          header: t("data.partner"),
          sortFn: "text",
          cell: (info) => (
            <div className="flex flex-col gap-1">
              {info.row.original.partners.map((p) => (
                <span key={p.id} className="flex items-center gap-1.5 whitespace-nowrap">
                  <PartnerBadge partner={p} size={18} />
                  {name(p)}
                </span>
              ))}
            </div>
          ),
        }),
        helper.accessor("committed", { header: t("data.committed"), cell: (info) => <span className="tabular whitespace-nowrap">{money(info.getValue())}</span> }),
        helper.accessor("disbursed", { header: t("data.disbursed"), cell: (info) => <span className="tabular whitespace-nowrap">{money(info.getValue())}</span> }),
        helper.accessor("progress", {
          header: t("data.status"),
          cell: (info) => (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <StatusPill status={info.row.original.status} className="bg-transparent px-0" />
              <span className="tabular text-xs text-l-muted">{info.getValue()}%</span>
            </div>
          ),
        }),
      ]),
    [t, name, money],
  );

  const table = useTable({
    features,
    columns,
    data,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  const totals = useMemo(
    () => data.reduce((a, r) => ({ c: a.c + r.committed, d: a.d + r.disbursed }), { c: 0, d: 0 }),
    [data],
  );

  const exportCsv = () => {
    const rows = table.getPrePaginatedRowModel().rows.map((r) => {
      const o = r.original;
      return {
        id: o.id,
        project: o.title,
        sector: o.sector,
        location: o.location,
        partners: o.partnerNames,
        committed_usd: Math.round(o.committed),
        disbursed_usd: Math.round(o.disbursed),
        status: o.statusLabel,
        progress_pct: o.progress,
      };
    });
    const blob = new Blob(["﻿" + Papa.unparse(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nepal-projects-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ---- active filter chips
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (view.area && areas?.get(view.area)) chips.push({ key: "area", label: name(areas.get(view.area)), clear: () => setView({ area: null }) });
  if (view.year) chips.push({ key: "year", label: String(view.year), clear: () => setView({ year: null }) });
  for (const p of view.partners) chips.push({ key: `p-${p}`, label: name(partners.get(p)) || p, clear: () => setView({ partners: view.partners.filter((x) => x !== p) }) });
  for (const s of view.sectors) chips.push({ key: `s-${s}`, label: name(sectors.get(s)) || s, clear: () => setView({ sectors: view.sectors.filter((x) => x !== s) }) });
  for (const s of view.status) chips.push({ key: `st-${s}`, label: t(`status.${s}`), clear: () => setView({ status: view.status.filter((x) => x !== s) }) });
  for (const f of view.flow) chips.push({ key: `f-${f}`, label: t(`flow.${f}`), clear: () => setView({ flow: view.flow.filter((x) => x !== f) }) });
  const anyFilter = activeFilterCount(view) > 0 || !!view.area;

  const { pageIndex, pageSize } = table.state.pagination;
  const total = data.length;
  const from = total ? pageIndex * pageSize + 1 : 0;
  const to = Math.min(total, (pageIndex + 1) * pageSize);
  const pages = Math.max(1, table.getPageCount());
  const isSample = dataset.projects.some((p) => p.is_sample);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("data.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-l-muted sm:text-base">{t("data.intro")}</p>
        </div>
        {isSample && <SampleBadge className="border-amber-500/50 bg-amber-100 text-amber-800" />}
      </div>

      {/* headline counters */}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: t("totals.committed"), value: money(totals.c) },
          { label: t("totals.disbursed"), value: money(totals.d) },
          { label: t("projects.list"), value: formatInt(total) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-l-border bg-l-panel px-3 py-3 sm:px-5 sm:py-4">
            <div className="tabular whitespace-nowrap font-display text-[15px] font-bold text-l-teal min-[420px]:text-lg sm:text-3xl">{c.value}</div>
            <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-l-muted sm:text-xs">{c.label}</div>
          </div>
        ))}
      </div>

      {/* toolbar */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-l-muted" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            placeholder={t("data.search")}
            aria-label={t("data.search")}
            className="w-full rounded-lg border border-l-border bg-l-panel py-2.5 pl-9 pr-3 text-sm text-l-text outline-none placeholder:text-l-muted focus:border-l-teal focus:ring-2 focus:ring-l-teal/20"
          />
        </label>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-lg bg-l-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark"
        >
          <Download className="size-4" /> {t("data.export")}
        </button>
      </div>

      {anyFilter && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-l-muted">{t("filters.filtered")}:</span>
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={c.clear}
              className="inline-flex items-center gap-1 rounded-full border border-l-teal/30 bg-l-teal/10 px-2.5 py-1 text-xs font-semibold text-l-teal hover:bg-l-teal/20"
            >
              {c.label} <X className="size-3" />
            </button>
          ))}
          <button
            onClick={() => setView({ area: null, year: null, partners: [], sectors: [], status: [], flow: [] })}
            className="text-xs font-semibold text-l-muted underline-offset-2 hover:text-l-text hover:underline"
          >
            {t("filters.clear")}
          </button>
        </div>
      )}

      {/* table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-l-border bg-l-panel">
        <table className="w-full min-w-[880px] border-collapse text-left text-sm">
          <thead>
            {table.getHeaderGroups().map((g) => (
              <tr key={g.id} className="border-b border-l-border bg-l-bg/60">
                {g.headers.map((h) => {
                  const dir = h.column.getIsSorted();
                  const numeric = h.column.id === "committed" || h.column.id === "disbursed";
                  return (
                    <th
                      key={h.id}
                      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                      className={cn("px-4 py-3 text-xs font-bold uppercase tracking-wider text-l-muted", numeric && "text-right")}
                    >
                      <button
                        onClick={h.column.getToggleSortingHandler()}
                        className={cn("inline-flex items-center gap-1 uppercase hover:text-l-text", dir && "text-l-text", numeric && "flex-row-reverse")}
                      >
                        <table.FlexRender header={h} />
                        {dir === "asc" ? <ArrowUp className="size-3.5" /> : dir === "desc" ? <ArrowDown className="size-3.5" /> : <ArrowUpDown className="size-3.5 opacity-40" />}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-l-border/70 align-top last:border-0 hover:bg-l-bg/70">
                {row.getAllCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn(
                      "px-4 py-3 text-l-text",
                      (cell.column.id === "committed" || cell.column.id === "disbursed") && "text-right",
                      cell.column.id === "title" && "min-w-64",
                      cell.column.id !== "title" && "text-[13px]",
                    )}
                  >
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
            {!total && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-l-muted">
                  {t("breakdown.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-l-muted">
        <span className="tabular">{t("data.rows", { from, to, total })}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="inline-flex items-center gap-1 rounded-lg border border-l-border bg-l-panel px-3 py-2 font-semibold text-l-text disabled:opacity-40"
          >
            <ChevronLeft className="size-4" /> {t("data.prev")}
          </button>
          <span className="tabular px-1">{t("data.page", { page: pageIndex + 1, pages })}</span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="inline-flex items-center gap-1 rounded-lg border border-l-border bg-l-panel px-3 py-2 font-semibold text-l-text disabled:opacity-40"
          >
            {t("data.next")} <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
