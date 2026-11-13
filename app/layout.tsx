import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { Masthead } from "@/components/layout/Masthead";
import { getDataset } from "@/lib/data/load-dataset";
import areaList from "@/public/geo/areas.json";
import type { Area } from "@/lib/data/types";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const display = Plus_Jakarta_Sans({ variable: "--font-display-face", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Nepal Development Projects Map",
  description: "Interactive map of development projects funded by Nepal's international partners, by province, district and palika.",
};

export const viewport: Viewport = { themeColor: "#16202b" };


export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [dataset, jar] = await Promise.all([getDataset(), cookies()]);
  const locale = jar.get(LOCALE_COOKIE)?.value === "ne" ? "ne" : "en";
  return (
    <html lang={locale === "ne" ? "ne-Latn" : "en"} className={`${inter.variable} ${display.variable} h-full`}>
      <body className="flex h-full min-h-dvh flex-col bg-bg text-text antialiased">
        <Providers dataset={dataset} areaList={areaList as Area[]} initialLocale={locale}>
          <Suspense>
            <Masthead />
          </Suspense>
          {children}
        </Providers>
      </body>
    </html>
  );
}
