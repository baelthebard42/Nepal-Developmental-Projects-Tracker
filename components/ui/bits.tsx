"use client";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { Partner, Status } from "@/lib/data/types";
import { cn } from "@/lib/utils";

/** Round flag (flag-icons) for countries/EU; initials badge for multilaterals (no logos). */
export function PartnerBadge({ partner, size = 22, className }: { partner?: Partner; size?: number; className?: string }) {
  if (!partner) return null;
  if (partner.iso2)
    return (
      <span
        aria-hidden
        className={cn("fi fis flag-round inline-block shrink-0", `fi-${partner.iso2}`, className)}
        style={{ width: size, height: size }}
      />
    );
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-[#dfe8ee] font-display font-bold text-[#16202b] ring-[1.5px] ring-white/50", className)}
      style={{ width: size, height: size, fontSize: Math.max(6.5, size * (partner.short.length > 4 ? 0.22 : partner.short.length > 3 ? 0.27 : 0.34)) }}
    >
      {partner.short}
    </span>
  );
}

export const STATUS_COLOR: Record<Status, string> = {
  pipeline: "var(--st-pipeline)",
  ongoing: "var(--st-ongoing)",
  completed: "var(--st-completed)",
  suspended: "var(--st-suspended)",
};

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  const t = useTranslations("status");
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold", className)}
      style={{ background: `color-mix(in srgb, ${STATUS_COLOR[status]} 18%, transparent)`, color: STATUS_COLOR[status] }}
    >
      <span className="size-1.5 rounded-full" style={{ background: STATUS_COLOR[status] }} />
      {t(status)}
    </span>
  );
}

/** Small segmented toggle, e.g. USD|NPR, EN|NE, 2D|3D */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg border border-line bg-bg/60 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md font-semibold transition-colors",
            size === "sm" ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-sm",
            o.value === value ? "bg-teal text-[#0f1a22]" : "text-muted hover:text-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Thin progress meter (used for share bars, progress, financial progress) */
export function Meter({ value, color = "var(--teal)", track = "rgba(139,159,174,0.35)", className, height = 4 }: { value: number; color?: string; track?: string; className?: string; height?: number }) {
  return (
    <div className={cn("w-full overflow-hidden rounded-full", className)} style={{ background: track, height }}>
      <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, background: color }} />
    </div>
  );
}

export function SampleBadge({ className }: { className?: string }) {
  const t = useTranslations("app");
  return (
    <span
      title={t("sampleNote")}
      className={cn("inline-flex items-center gap-1 rounded-full border border-sample/50 bg-sample/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-sample", className)}
    >
      <span className="size-1.5 rounded-full bg-sample" />
      {t("sample")}
    </span>
  );
}
