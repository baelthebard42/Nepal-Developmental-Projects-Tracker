"use client";
import { useCallback } from "react";
import { useData } from "@/components/providers";
import { formatMoney, fxRate } from "@/lib/format/money";
import { useViewState } from "@/lib/state/url-state";

/** money formatter bound to the current currency (URL `cur`) and year's FX rate */
export function useMoney() {
  const [{ cur, year }] = useViewState();
  const { dataset } = useData();
  const rate = fxRate(dataset.fx, year);
  return useCallback((usd: number) => formatMoney(usd, cur, rate), [cur, rate]);
}
