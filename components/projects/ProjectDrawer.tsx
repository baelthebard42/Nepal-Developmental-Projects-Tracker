"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowRight, X } from "lucide-react";
import { useData, useLocalName } from "@/components/providers";
import { Meter, PartnerBadge, SampleBadge, StatusPill } from "@/components/ui/bits";
import { useViewState } from "@/lib/state/url-state";
import { useMoney } from "@/lib/hooks/use-money";

/** Summary drawer over the map (plan §5.3 #10) */
export function ProjectDrawer() {
  const t = useTranslations();
  const name = useLocalName();
  const { dataset, partners, sectors, areas } = useData();
  const [view, setView] = useViewState();
  const money = useMoney();
  const p = view.project ? dataset.projects.find((x) => x.id === view.project) : undefined;

  const c = p ? p.funding.reduce((s, f) => s + f.committed_usd, 0) : 0;
  const d = p ? p.funding.reduce((s, f) => s + f.disbursed_usd, 0) : 0;
  const close = () => setView({ project: null });

  return (
    <AnimatePresence>
      {p && (
        <motion.aside
          key={p.id}
          initial={{ x: "105%" }}
          animate={{ x: 0 }}
          exit={{ x: "105%" }}
          transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
          className="scroll-thin absolute inset-y-2 right-2 z-30 flex w-[min(400px,calc(100%-1rem))] flex-col overflow-y-auto rounded-xl border border-line bg-panel/97 shadow-2xl backdrop-blur"
          role="dialog"
          aria-label={name(p)}
          onKeyDown={(e) => e.key === "Escape" && close()}
        >
          <div className="flex items-start gap-3 border-b border-line p-4">
            <div className="flex -space-x-1.5 pt-0.5">
              {p.funding.map((f) => <PartnerBadge key={f.partner_id} partner={partners.get(f.partner_id)} size={28} />)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-muted">{p.funding.map((f) => name(partners.get(f.partner_id))).join(" · ")}</div>
              <h2 className="mt-0.5 font-display text-lg font-semibold leading-snug">{name(p)}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusPill status={p.status} />
                {p.is_sample && <SampleBadge />}
              </div>
            </div>
            <button onClick={close} className="rounded-lg p-1.5 text-muted hover:bg-panel-2 hover:text-text" aria-label={t("projects.close")} autoFocus>
              <X className="size-5" />
            </button>
          </div>
          <div className="space-y-4 p-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-bg/50 p-3">
                <div className="text-xs uppercase tracking-wider text-muted">{t("totals.committed")}</div>
                <div className="mt-0.5 font-display text-xl font-semibold tabular">{money(c)}</div>
              </div>
              <div className="rounded-lg bg-bg/50 p-3">
                <div className="text-xs uppercase tracking-wider text-muted">{t("totals.disbursed")}</div>
                <div className="mt-0.5 font-display text-xl font-semibold tabular text-teal">{money(d)}</div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs"><span className="text-muted">{t("project.physical")}</span><b>{p.progress_pct}%</b></div>
              <Meter className="mt-1" value={p.progress_pct / 100} color="var(--st-completed)" height={6} />
              <div className="mt-2.5 flex justify-between text-xs"><span className="text-muted">{t("project.financial")}</span><b>{c ? Math.round((d / c) * 100) : 0}%</b></div>
              <Meter className="mt-1" value={c ? d / c : 0} height={6} />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted">{t("project.sector")}</dt><dd>{name(sectors.get(p.sector_code))}</dd>
              <dt className="text-muted">{t("project.flow")}</dt><dd>{t(`flow.${p.flow_type}`)}</dd>
              <dt className="text-muted">{t("project.locations")}</dt>
              <dd>{p.locations.length ? p.locations.map((l) => areas?.get(l.area_code)?.short ?? l.area_code).join(", ") : t("project.nationwide")}</dd>
              <dt className="text-muted">{t("project.dates")}</dt><dd className="tabular">{p.start_date.slice(0, 7)} → {p.end_date.slice(0, 7)}</dd>
              <dt className="text-muted">{t("project.implementer")}</dt><dd>{p.implementing_partner}</dd>
            </dl>
            <p className="leading-relaxed text-[#c5d2dc]">{p.description_en}</p>
            <Link href={`/projects/${p.id}`} className="flex items-center justify-center gap-2 rounded-lg bg-teal px-4 py-2.5 font-bold text-[#0f1a22] hover:bg-teal-hover">
              {t("projects.openFull")} <ArrowRight className="size-4" />
            </Link>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
