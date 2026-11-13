"use client";
import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Fuse from "fuse.js";
import { Search, X } from "lucide-react";
import { useData, useLocalName } from "@/components/providers";
import { PartnerBadge } from "@/components/ui/bits";
import { useViewState } from "@/lib/state/url-state";
import { cn } from "@/lib/utils";

type Hit =
  | { kind: "area"; code: string; label: string; sub: string; aliases: string }
  | { kind: "partner"; code: string; label: string; sub: string; aliases: string }
  | { kind: "project"; code: string; label: string; sub: string; aliases: string };

/** One box for any district, palika, partner or project (plan §5.3 #12) */
export function SearchBox() {
  const t = useTranslations();
  const name = useLocalName();
  const { areas, dataset, partners } = useData();
  const [, setView] = useViewState();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const fuse = useMemo(() => {
    const items: Hit[] = [
      ...(areas?.areas ?? []).map((a) => ({
        kind: "area" as const,
        code: a.code,
        label: a.level === "palika" ? name(a) : a.level === "province" ? name(a) : a.short,
        sub: [t(`levels.${a.level}`), ...areas!.path(a.code).slice(0, -1).map((p) => p.short)].join(" · "),
        aliases: (a.aliases ?? []).join(" "),
      })),
      ...dataset.partners.map((p) => ({ kind: "partner" as const, code: p.id, label: name(p), sub: t("search.partners"), aliases: `${p.name_en} ${p.short}` })),
      ...dataset.projects.map((p) => ({ kind: "project" as const, code: p.id, label: name(p), sub: p.mofa_ref, aliases: p.title_en })),
    ];
    return new Fuse(items, { keys: [{ name: "label", weight: 3 }, "aliases", "sub"], threshold: 0.32, ignoreLocation: true });
  }, [areas, dataset, name, t]);

  const hits = q.trim().length >= 2 ? fuse.search(q.trim(), { limit: 9 }).map((r) => r.item) : [];

  const choose = (h: Hit) => {
    if (h.kind === "area") setView({ area: h.code, project: null });
    else if (h.kind === "partner") setView({ partners: [h.code], tab: "partners" });
    else setView({ project: h.code });
    setQ("");
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div id="search" className="relative">
      <div className={cn("flex h-10 items-center gap-2 rounded-lg bg-bg/90 px-3 shadow-lg ring-teal/60 transition-[width] focus-within:ring-2", "w-10 sm:w-64 lg:w-72 max-sm:focus-within:w-[calc(100vw-7rem)]")}>
        <Search className="size-4 shrink-0 text-muted" />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, hits.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter" && hits[active]) choose(hits[active]);
            if (e.key === "Escape") { setQ(""); input.current?.blur(); }
          }}
          placeholder={t("search.placeholder")}
          aria-label={t("nav.search")}
          className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Clear">
            <X className="size-4 text-muted" />
          </button>
        )}
      </div>
      {open && q.trim().length >= 2 && (
        <ul role="listbox" className="absolute right-0 z-40 mt-1.5 max-h-96 w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-line bg-panel p-1.5 shadow-2xl">
          {hits.length === 0 && <li className="px-3 py-2.5 text-sm text-muted">{t("search.none")}</li>}
          {hits.map((h, i) => (
            <li key={`${h.kind}-${h.code}`} role="option" aria-selected={i === active}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(h)}
                onMouseEnter={() => setActive(i)}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left", i === active && "bg-panel-2")}
              >
                {h.kind === "partner" ? (
                  <PartnerBadge partner={partners.get(h.code)} size={20} />
                ) : (
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded text-[10px] font-bold", h.kind === "area" ? "bg-teal/20 text-teal" : "bg-blue/20 text-blue")}>
                    {h.kind === "area" ? "◎" : "▣"}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{h.label}</span>
                  <span className="block truncate text-xs text-muted">{h.sub}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
