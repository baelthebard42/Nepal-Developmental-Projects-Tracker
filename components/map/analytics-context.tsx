"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useAnalytics, type Analytics } from "@/lib/hooks/use-analytics";

const Ctx = createContext<Analytics | null>(null);

/** computes filter + aggregation once per view and shares it between panel, map and tooltip */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const a = useAnalytics();
  return <Ctx.Provider value={a}>{children}</Ctx.Provider>;
}

export function useA() {
  const a = useContext(Ctx);
  if (!a) throw new Error("useA outside <AnalyticsProvider>");
  return a;
}
