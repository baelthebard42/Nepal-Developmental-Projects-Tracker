"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useData, useLocalName } from "@/components/providers";
import { PartnerBadge } from "@/components/ui/bits";
import type { Project } from "@/lib/data/types";
import { pct } from "@/lib/format/money";
import { useMoney } from "@/lib/hooks/use-money";
import { formatDate } from "./format-date";

function Fact({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-bold uppercase tracking-wider text-l-muted">{label}</dt>
      <dd className="mt-1 text-[15px] text-l-text">{children}</dd>
    </div>
  );
}

export function KeyFacts({ project }: { project: Project }) {
  const t = useTranslations();
  const name = useLocalName();
  const money = useMoney();
  const { partners, sectors, areas } = useData();
  const total = project.funding.reduce((a, f) => a + f.committed_usd, 0) || 1;

  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      <Fact label={t("project.partners")} wide>
        <ul className="space-y-2">
          {project.funding.map((f) => {
            const p = partners.get(f.partner_id);
            return (
              <li key={f.partner_id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <PartnerBadge partner={p} size={22} />
                <span className="font-semibold">{name(p) || f.partner_id}</span>
                <span className="tabular text-sm text-l-muted">
                  {money(f.committed_usd)} · {pct(f.committed_usd / total)}
                </span>
              </li>
            );
          })}
        </ul>
      </Fact>
      <Fact label={t("project.implementer")}>{project.implementing_partner || t("common.na")}</Fact>
      <Fact label={t("project.sector")}>{name(sectors.get(project.sector_code)) || project.sector_code}</Fact>
      <Fact label={t("project.flow")}>{t(`flow.${project.flow_type}`)}</Fact>
      <Fact label={t("project.ref")}>
        <span className="tabular font-mono text-sm">{project.mofa_ref}</span>
      </Fact>
      <Fact label={t("project.locations")} wide>
        {project.locations.length ? (
          <div className="flex flex-wrap gap-1.5">
            {project.locations.map((l) => {
              const a = areas?.get(l.area_code);
              const parent = a?.level === "palika" ? areas?.get(a.parent) : undefined;
              return (
                <Link
                  key={l.area_code}
                  href={`/?area=${encodeURIComponent(l.area_code)}`}
                  className="rounded-full border border-l-teal/30 bg-l-teal/10 px-2.5 py-1 text-sm font-semibold text-l-teal hover:bg-l-teal/20"
                >
                  {a ? name(a) : l.area_code}
                  {parent && <span className="font-normal text-l-muted"> · {name(parent)}</span>}
                  {l.share_pct != null && <span className="font-normal text-l-muted"> · {l.share_pct}%</span>}
                </Link>
              );
            })}
          </div>
        ) : (
          t("project.nationwide")
        )}
      </Fact>
      <Fact label={t("project.dates")} wide>
        <div className="grid grid-cols-3 gap-3">
          {[
            [t("project.agreement"), project.agreement_date],
            [t("project.start"), project.start_date],
            [t("project.end"), project.end_date],
          ].map(([l, d]) => (
            <div key={l}>
              <div className="text-xs text-l-muted">{l}</div>
              <div className="tabular font-semibold">{d ? formatDate(d) : t("common.na")}</div>
            </div>
          ))}
        </div>
      </Fact>
      <Fact label={t("project.source")} wide>
        <span className="text-sm text-l-muted">{project.source}</span>
      </Fact>
    </dl>
  );
}
