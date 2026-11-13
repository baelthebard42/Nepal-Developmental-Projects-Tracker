"use client";
import { Meter } from "@/components/ui/bits";

export function ProgressBar({ label, value, detail, color, track = "#dbe3e9" }: { label: string; value: number; detail?: string; color: string; track?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-l-muted">{label}</span>
        <span className="tabular font-display text-lg font-bold" style={{ color }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <Meter value={value} color={color} track={track} height={8} className="mt-1.5" />
      {detail && <div className="tabular mt-1.5 text-xs text-l-muted">{detail}</div>}
    </div>
  );
}
