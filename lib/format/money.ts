export type Currency = "USD" | "NPR";

const trim = (n: number, digits = 1) => {
  const s = n.toFixed(n >= 100 ? 0 : digits);
  return s.replace(/\.0+$/, "");
};

/** "USD 1.2B", "USD 450M", "USD 85K" */
export function formatUSD(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `USD ${trim(v / 1e9)}B`;
  if (a >= 1e6) return `USD ${trim(v / 1e6)}M`;
  if (a >= 1e3) return `USD ${trim(v / 1e3)}K`;
  return `USD ${Math.round(v)}`;
}

/** Nepali units: 1 lakh = 1e5, 1 crore = 1e7, 1 arba = 1e9. "Rs 15.6 crore", "Rs 84 arba" */
export function formatNPR(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `Rs ${trim(v / 1e9)} arba`;
  if (a >= 1e7) return `Rs ${trim(v / 1e7)} crore`;
  if (a >= 1e5) return `Rs ${trim(v / 1e5)} lakh`;
  return `Rs ${Math.round(v).toLocaleString("en-IN")}`;
}

export function fxRate(fx: Record<string, number>, year: number | null): number {
  const years = Object.keys(fx).map(Number).sort((a, b) => a - b);
  if (!years.length) return 1;
  const y = year && fx[year] ? year : years[years.length - 1];
  return fx[y];
}

export function formatMoney(usd: number, cur: Currency, rate: number): string {
  return cur === "USD" ? formatUSD(usd) : formatNPR(usd * rate);
}

/** split "USD 1.2B" into unit + figure for the big counters */
export function splitMoney(s: string): { unit: string; value: string; suffix: string } {
  const m = s.match(/^(USD|Rs)\s+([\d.,]+)\s*(.*)$/);
  return m ? { unit: m[1], value: m[2], suffix: m[3] } : { unit: "", value: s, suffix: "" };
}

export const formatInt = (n: number) => n.toLocaleString("en-US");
export const pct = (n: number) => `${Math.round(n * 100)}%`;
