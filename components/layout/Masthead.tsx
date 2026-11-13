"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleHelp } from "lucide-react";
import { useData, useLocaleStore } from "@/components/providers";
import { SampleBadge, Segmented } from "@/components/ui/bits";
import { ShareMenu } from "@/components/layout/ShareMenu";
import { useViewState } from "@/lib/state/url-state";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  // Mountain ridge in a ring: a nod to the Himalaya, not an official emblem.
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="20" cy="20" r="18" fill="none" stroke="var(--teal)" strokeWidth="2.4" />
      <path d="M7 27 L14 17 L18 22 L24 12 L33 27 Z" fill="var(--teal)" opacity="0.9" />
      <path d="M22.2 15 L24 12 L25.8 15 L24.6 14.4 L24 15.6 L23.3 14.4 Z" fill="#eaf0f5" />
    </svg>
  );
}

export function Masthead() {
  const t = useTranslations();
  const path = usePathname();
  const { locale, setLocale } = useLocaleStore();
  const [view, setView] = useViewState();
  const { dataset } = useData();
  const isSample = dataset.projects.some((p) => p.is_sample);

  // keep the current filters when switching between Map and Data
  const sp = useSearchParams();
  const keep = new URLSearchParams(sp);
  keep.delete("project");
  const qs = keep.size ? `?${keep}` : "";
  const nav = [
    { href: "/", label: t("nav.map"), active: path === "/" },
    { href: "/data", label: t("nav.data"), active: path.startsWith("/data") },
  ];

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line/60 bg-bg px-3 sm:px-4">
      <Link href={`/${qs}`} className="flex min-w-0 items-center gap-2.5" aria-label={t("app.title")}>
        <Logo className="size-8 shrink-0" />
        <div className="min-w-0 leading-tight">
          <div className="truncate font-display text-[13px] font-bold uppercase tracking-wide sm:text-sm">{t("app.title")}</div>
          <div className="hidden truncate text-[11px] font-medium uppercase tracking-wider text-muted sm:block">{t("app.subtitle")}</div>
        </div>
      </Link>
      {isSample && <SampleBadge className="hidden md:inline-flex" />}

      <nav className="ml-auto flex items-center gap-1" aria-label="Main">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={`${n.href}${qs}`}
            className={cn(
              "relative rounded-md px-2.5 py-1.5 text-[15px] font-semibold transition-colors",
              n.active ? "text-text" : "text-muted hover:text-text",
            )}
          >
            {n.label}
            {n.active && <span className="absolute -bottom-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-teal" />}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <Segmented
          label={t("cur.label")}
          value={view.cur}
          onChange={(cur) => setView({ cur })}
          options={[{ value: "USD", label: "USD" }, { value: "NPR", label: "NPR" }]}
          size="sm"
          className="hidden sm:inline-flex"
        />
        <Segmented
          label={t("lang.label")}
          value={locale}
          onChange={setLocale}
          options={[{ value: "en", label: "EN", title: "English" }, { value: "ne", label: "NE", title: "Nepali (Romanized)" }]}
          size="sm"
        />
        {path === "/" && (
          <button
            id="tour-button"
            onClick={() => window.dispatchEvent(new Event("start-tour"))}
            className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-muted hover:text-text md:inline-flex"
          >
            <CircleHelp className="size-4" /> {t("nav.tour")}
          </button>
        )}
        <ShareMenu />
      </div>
    </header>
  );
}
