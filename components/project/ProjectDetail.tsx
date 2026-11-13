"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { useData, useLocalName } from "@/components/providers";
import { PartnerBadge, SampleBadge, StatusPill } from "@/components/ui/bits";
import type { Project } from "@/lib/data/types";
import { useMoney } from "@/lib/hooks/use-money";
import { KeyFacts } from "./KeyFacts";
import { MiniMap } from "./MiniMap";
import { ProgressBar } from "./ProgressBars";
import { TransactionTable } from "./TransactionTable";
import { UpdatesTimeline } from "./UpdatesTimeline";

function Card({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-l-border bg-l-panel p-4 sm:p-6 ${className ?? ""}`}>
      <h2 className="mb-4 font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function ProjectDetail({ project }: { project: Project }) {
  const t = useTranslations();
  const name = useLocalName();
  const money = useMoney();
  const { partners } = useData();

  const committed = project.funding.reduce((a, f) => a + f.committed_usd, 0);
  const disbursed = project.funding.reduce((a, f) => a + f.disbursed_usd, 0);
  const financial = committed ? disbursed / committed : 0;
  const lead = project.funding.map((f) => partners.get(f.partner_id)).filter(Boolean);

  return (
    <main className="flex-1 overflow-y-auto bg-l-bg text-l-text">
      {/* dark header band, like Lowy's project page */}
      <div className="border-b border-line/60 bg-panel text-text">
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-4 sm:px-6 sm:pb-8">
          <Link href={`/?project=${encodeURIComponent(project.id)}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-teal">
            <ArrowLeft className="size-4" /> {t("project.back")}
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex -space-x-1.5">
              {lead.map((p) => (
                <PartnerBadge key={p!.id} partner={p} size={30} />
              ))}
            </div>
            <span className="text-sm font-semibold text-muted">{lead.map((p) => name(p)).join(" · ")}</span>
            <StatusPill status={project.status} />
            {project.is_sample && <SampleBadge />}
          </div>
          <h1 className="mt-3 max-w-4xl font-display text-2xl font-bold leading-tight sm:text-4xl">{name(project)}</h1>
          <div className="mt-5 grid gap-5 sm:grid-cols-[auto_auto_1fr_1fr] sm:items-end sm:gap-8">
            <div>
              <div className="tabular font-display text-2xl font-bold text-teal sm:text-3xl">{money(committed)}</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">{t("totals.committed")}</div>
            </div>
            <div>
              <div className="tabular font-display text-2xl font-bold sm:text-3xl">{money(disbursed)}</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">{t("totals.disbursed")}</div>
            </div>
            <div className="[&_.text-l-muted]:text-muted">
              <ProgressBar label={t("project.physical")} value={project.progress_pct / 100} color="var(--teal)" track="rgba(139,159,174,0.3)" />
            </div>
            <div className="[&_.text-l-muted]:text-muted">
              <ProgressBar label={t("project.financial")} value={financial} color="var(--st-completed)" track="rgba(139,159,174,0.3)" />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4 sm:space-y-6">
          <Card title={t("project.description")}>
            <p className="leading-relaxed text-l-text">{project.description_en}</p>
          </Card>
          <Card title={t("project.keyFacts")}>
            <KeyFacts project={project} />
          </Card>
          <Card title={t("project.transactions")}>
            <TransactionTable transactions={project.transactions} />
          </Card>
        </div>
        <aside className="min-w-0 space-y-4 sm:space-y-6">
          <Card title={t("project.locations")}>
            <MiniMap
              codes={project.locations.map((l) => l.area_code)}
              nationwide={!project.locations.length}
              label={t("project.locations")}
            />
          </Card>
          <Card title={t("project.updates")}>
            <UpdatesTimeline updates={project.updates} />
          </Card>
        </aside>
      </div>
    </main>
  );
}
