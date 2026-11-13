"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import ne from "@/messages/ne.json";
import type { Area, Dataset, Partner, Sector } from "@/lib/data/types";
import { AreaIndex } from "@/lib/geo/area-index";

// ---------- language ----------
// Stored in a cookie that the server reads (app/layout.tsx), so the first render is already in the
// right language: no flash and no hydration mismatch. The URL stays the same.
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";
export type { Locale };
const LocaleCtx = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({ locale: "en", setLocale: () => {} });
export const useLocale = () => useContext(LocaleCtx).locale;
export const useLocaleStore = () => useContext(LocaleCtx);

/** picks name_en / name_ne (or title_*) for the current language */
export function useLocalName() {
  const locale = useLocale();
  return <T extends { name_en?: string; name_ne?: string; title_en?: string; title_ne?: string }>(o: T | undefined | null) =>
    !o ? "" : locale === "ne" ? (o.name_ne ?? o.title_ne ?? o.name_en ?? o.title_en ?? "") : (o.name_en ?? o.title_en ?? "");
}

// ---------- dataset + area index ----------
interface DataCtx {
  dataset: Dataset;
  partners: Map<string, Partner>;
  sectors: Map<string, Sector>;
  /** passed from the server, so server and client render identical numbers (typed nullable for safety) */
  areas: AreaIndex | null;
}
const Ctx = createContext<DataCtx | null>(null);

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useData outside <Providers>");
  return c;
}

export function Providers({ dataset, areaList, initialLocale, children }: { dataset: Dataset; areaList: Area[]; initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const setLocale = useCallback((l: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    setLocaleState(l);
  }, []);
  const localeValue = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  useEffect(() => {
    document.documentElement.lang = locale === "ne" ? "ne-Latn" : "en";
  }, [locale]);

  const value = useMemo<DataCtx>(
    () => ({
      dataset,
      partners: new Map(dataset.partners.map((p) => [p.id, p])),
      sectors: new Map(dataset.sectors.map((s) => [s.code, s])),
      areas: new AreaIndex(areaList),
    }),
    [dataset, areaList],
  );

  return (
    <NuqsAdapter>
      <NextIntlClientProvider locale={locale} messages={locale === "ne" ? ne : en} timeZone="Asia/Kathmandu">
        <LocaleCtx.Provider value={localeValue}>
          <Ctx.Provider value={value}>{children}</Ctx.Provider>
        </LocaleCtx.Provider>
      </NextIntlClientProvider>
    </NuqsAdapter>
  );
}
