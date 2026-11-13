"use client";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { Check, X } from "lucide-react";
import { useData, useLocalName } from "@/components/providers";
import { PartnerBadge, STATUS_COLOR } from "@/components/ui/bits";
import { useA } from "@/components/map/analytics-context";
import { useUI } from "@/lib/state/ui-store";
import { useViewState } from "@/lib/state/url-state";
import { FLOW_TYPES, STATUSES } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
        on ? "border-teal bg-teal/15 text-text" : "border-line bg-bg/40 text-[#c5d2dc] hover:border-muted",
      )}
    >
      <span className={cn("grid size-4 shrink-0 place-items-center rounded border", on ? "border-teal bg-teal" : "border-muted")}>
        {on && <Check className="size-3 text-[#0f1a22]" strokeWidth={3} />}
      </span>
      {children}
    </button>
  );
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

/** Filter dialog (plan §5.3 #9) */
export function FilterDialog() {
  const t = useTranslations();
  const name = useLocalName();
  const { dataset } = useData();
  const a = useA();
  const open = useUI((s) => s.filtersOpen);
  const [view, setView] = useViewState();
  const setOpen = (o: boolean) => useUI.getState().set({ filtersOpen: o });

  const years: number[] = [];
  if (a.yearRange) for (let y = a.yearRange[0]; y <= a.yearRange[1]; y++) years.push(y);
  const groups = [
    { key: "bilateral", items: dataset.partners.filter((p) => p.type === "bilateral" || p.id === "eu") },
    { key: "multilateral", items: dataset.partners.filter((p) => !(p.type === "bilateral" || p.id === "eu")) },
  ];
  const h = "mb-2.5 text-xs font-bold uppercase tracking-wider text-muted";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border border-line bg-panel text-text shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(760px,94vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <Dialog.Title className="font-display text-xl font-semibold">{t("filters.title")}</Dialog.Title>
            <Dialog.Description className="sr-only">{t("filters.title")}</Dialog.Description>
            <Dialog.Close className="rounded-lg p-1.5 text-muted hover:bg-panel-2 hover:text-text" aria-label={t("projects.close")}>
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="scroll-thin flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <section>
              <h3 className={h}>{t("filters.partners")}</h3>
              {groups.map((g) => (
                <div key={g.key} className="mb-3">
                  <div className="mb-1.5 text-xs text-muted">{t(`filters.${g.key}`)}</div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {g.items.map((p) => (
                      <Chip key={p.id} on={view.partners.includes(p.id)} onClick={() => setView({ partners: toggle(view.partners, p.id) })}>
                        <PartnerBadge partner={p} size={18} />
                        <span className="truncate">{name(p)}</span>
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
            </section>
            <section>
              <h3 className={h}>{t("filters.sectors")}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {dataset.sectors.map((s) => (
                  <Chip key={s.code} on={view.sectors.includes(s.code)} onClick={() => setView({ sectors: toggle(view.sectors, s.code) })}>
                    {name(s)}
                  </Chip>
                ))}
              </div>
            </section>
            <div className="grid gap-6 sm:grid-cols-2">
              <section>
                <h3 className={h}>{t("filters.status")}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {STATUSES.map((s) => (
                    <Chip key={s} on={view.status.includes(s)} onClick={() => setView({ status: toggle(view.status, s) })}>
                      <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                      {t(`status.${s}`)}
                    </Chip>
                  ))}
                </div>
              </section>
              <section>
                <h3 className={h}>{t("filters.flow")}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {FLOW_TYPES.map((f) => (
                    <Chip key={f} on={view.flow.includes(f)} onClick={() => setView({ flow: toggle(view.flow, f) })}>
                      {t(`flow.${f}`)}
                    </Chip>
                  ))}
                </div>
              </section>
            </div>
            <section>
              <h3 className={h}>{t("filters.years")}</h3>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setView({ year: null })} className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold", !view.year ? "border-teal bg-teal text-[#0f1a22]" : "border-line text-[#c5d2dc] hover:border-muted")}>
                  {t("nav.allYears")}
                </button>
                {years.map((y) => (
                  <button key={y} onClick={() => setView({ year: y })} className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold tabular", view.year === y ? "border-teal bg-teal text-[#0f1a22]" : "border-line text-[#c5d2dc] hover:border-muted")}>
                    {y}
                  </button>
                ))}
              </div>
            </section>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
            <button
              onClick={() => setView({ partners: [], sectors: [], status: [], flow: [], year: null })}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-text"
            >
              {t("filters.clear")}
            </button>
            <Dialog.Close className="rounded-lg bg-teal px-5 py-2.5 text-sm font-bold text-[#0f1a22] hover:bg-teal-hover">
              {t("filters.apply")} · {t("projects.count", { count: a.agg?.totals.count ?? 0 })}
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
