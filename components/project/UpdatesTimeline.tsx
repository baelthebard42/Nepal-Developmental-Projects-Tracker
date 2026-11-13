"use client";
import { useTranslations } from "next-intl";
import type { ProjectUpdate } from "@/lib/data/types";
import { formatDate } from "./format-date";

export function UpdatesTimeline({ updates }: { updates: ProjectUpdate[] }) {
  const t = useTranslations("project");
  if (!updates.length) return <p className="text-sm text-l-muted">{t("noUpdates")}</p>;
  const sorted = [...updates].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <ol className="relative ml-1.5 border-l-2 border-l-border">
      {sorted.map((u, i) => (
        <li key={i} className="relative pb-5 pl-5 last:pb-0">
          <span className={`absolute -left-[7px] top-1 size-3 rounded-full ring-4 ring-l-panel ${i === 0 ? "bg-l-teal" : "bg-[#b7c6d1]"}`} />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <time className="tabular text-xs font-bold uppercase tracking-wider text-l-muted">{formatDate(u.date)}</time>
            {u.progress_pct != null && <span className="tabular text-xs font-semibold text-l-teal">{u.progress_pct}%</span>}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-l-text">{u.body_en}</p>
        </li>
      ))}
    </ol>
  );
}
