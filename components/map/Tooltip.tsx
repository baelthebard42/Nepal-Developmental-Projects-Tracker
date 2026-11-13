"use client";
import { useTranslations } from "next-intl";
import { useData, useLocalName } from "@/components/providers";
import { useA } from "@/components/map/analytics-context";
import { Meter, PartnerBadge, StatusPill, STATUS_COLOR } from "@/components/ui/bits";
import { useUI } from "@/lib/state/ui-store";
import { useMoney } from "@/lib/hooks/use-money";
import { STATUSES } from "@/lib/data/types";

/** Hover card for areas and project dots (plan §5.3 #2) */
export function MapTooltip() {
  const t = useTranslations();
  const name = useLocalName();
  const { areas, partners, dataset } = useData();
  const a = useA();
  const money = useMoney();
  const { hoverArea, hoverPoint, hoverProject } = useUI();
  if (!hoverPoint) return null;

  const style = {
    left: hoverPoint.x,
    top: hoverPoint.y,
    transform: `translate(${hoverPoint.x > 520 ? "calc(-100% - 16px)" : "16px"}, ${hoverPoint.y > 330 ? "calc(-100% - 8px)" : "8px"})`,
  };
  const card = "pointer-events-none absolute z-20 w-[300px] rounded-xl border border-line bg-panel/95 p-3.5 text-sm shadow-2xl backdrop-blur";

  if (hoverProject) {
    const p = dataset.projects.find((x) => x.id === hoverProject);
    if (!p) return null;
    const c = p.funding.reduce((s, f) => s + f.committed_usd, 0);
    const d = p.funding.reduce((s, f) => s + f.disbursed_usd, 0);
    return (
      <div className={card} style={style} role="tooltip">
        <div className="flex items-center gap-2">
          {p.funding.map((f) => <PartnerBadge key={f.partner_id} partner={partners.get(f.partner_id)} size={18} />)}
          <StatusPill status={p.status} className="ml-auto" />
        </div>
        <div className="mt-2 font-semibold leading-snug">{name(p)}</div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>{t("totals.committed")} <b className="text-text">{money(c)}</b></span>
          <span>{t("totals.disbursed")} <b className="text-text">{money(d)}</b></span>
        </div>
        <Meter className="mt-1.5" value={c ? d / c : 0} />
        <div className="mt-2 text-xs text-teal">{t("map.clickToOpen")}</div>
      </div>
    );
  }

  const area = areas?.get(hoverArea);
  if (!area || !a.agg) return null;
  const x = a.agg.byArea.get(area.code);
  const parents = areas!.path(area.code).slice(0, -1).map((p) => (p.level === "province" ? name(p) : p.short));
  const top = x ? [...x.partners.entries()].sort((p, q) => q[1] - p[1]).slice(0, 3) : [];
  const statusTotal = x ? STATUSES.reduce((s, k) => s + x.status[k], 0) : 0;

  return (
    <div className={card} style={style} role="tooltip">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {t(`levels.${area.level}`)}{parents.length ? ` · ${parents.join(" › ")}` : ""}
      </div>
      <div className="mt-0.5 font-display text-lg font-semibold leading-tight">{area.level === "palika" ? name(area) : name(area)}</div>
      {area.kind === "special_region" && <div className="mt-1 text-xs text-muted">{t("map.kalapani")}</div>}
      {!x ? (
        <div className="mt-2 text-muted">{t("map.noProjects")}</div>
      ) : (
        <>
          <div className="mt-2.5 grid grid-cols-[auto_1fr_1fr] gap-3 whitespace-nowrap">
            <div>
              <div className="font-display text-[15px] font-semibold tabular">{x.count}</div>
              <div className="text-[11px] uppercase tracking-wide text-muted">{t("metric.count")}</div>
            </div>
            <div>
              <div className="font-display text-[15px] font-semibold tabular">{money(x.committed)}</div>
              <div className="text-[11px] uppercase tracking-wide text-muted">{t("totals.committed")}</div>
            </div>
            <div>
              <div className="font-display text-[15px] font-semibold tabular text-teal">{money(x.disbursed)}</div>
              <div className="text-[11px] uppercase tracking-wide text-muted">{t("totals.disbursed")}</div>
            </div>
          </div>
          <Meter className="mt-2" value={x.committed ? x.disbursed / x.committed : 0} />
          {top.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t("map.topPartners")}</div>
              <ul className="mt-1.5 space-y-1">
                {top.map(([pid, v]) => (
                  <li key={pid} className="flex items-center gap-2">
                    <PartnerBadge partner={partners.get(pid)} size={16} />
                    <span className="truncate">{name(partners.get(pid))}</span>
                    <span className="ml-auto text-xs tabular text-muted">{money(v)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 flex h-1.5 overflow-hidden rounded-full">
            {STATUSES.map((s) => (x.status[s] ? <span key={s} style={{ width: `${(x.status[s] / statusTotal) * 100}%`, background: STATUS_COLOR[s] }} /> : null))}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-2.5 text-[11px] text-muted">
            {STATUSES.map((s) => (x.status[s] ? <span key={s}>{t(`status.${s}`)} {x.status[s]}</span> : null))}
          </div>
        </>
      )}
      {area.code !== a.scope && <div className="mt-2.5 text-xs font-semibold text-teal">{t("map.clickToOpen")} →</div>}
    </div>
  );
}
