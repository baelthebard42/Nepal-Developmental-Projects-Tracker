"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { AnalyticsProvider } from "@/components/map/analytics-context";
import { OverviewPanel } from "@/components/panel/OverviewPanel";
import { RightRail } from "@/components/map/RightRail";
import { Breadcrumb } from "@/components/map/Breadcrumb";
import { MapControls, MetricLegend } from "@/components/map/MapControls";
import { MapTooltip } from "@/components/map/Tooltip";
import { SearchBox } from "@/components/filters/SearchBox";
import { FilterDialog } from "@/components/filters/FilterDialog";
import { ProjectDrawer } from "@/components/projects/ProjectDrawer";
import { Tour } from "@/components/layout/Tour";
import { useViewState } from "@/lib/state/url-state";
import { useTranslations } from "next-intl";
import { LayoutGrid, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

// MapLibre / deck.gl only run in the browser (plan §6.3)
const NepalMap = dynamic(() => import("@/components/map/NepalMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse" />,
});

function useStagePadding(ref: React.RefObject<HTMLElement | null>) {
  const [pad, setPad] = useState({ top: 70, bottom: 100, left: 50, right: 50 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      const next = w < 640 ? { top: 60, bottom: 70, left: 12, right: 12 } : w < 1000 ? { top: 70, bottom: 90, left: 30, right: 30 } : { top: 70, bottom: 100, left: 50, right: 50 };
      setPad((p) => (p.top === next.top && p.left === next.left ? p : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return pad;
}

export function MapExplorer() {
  const t = useTranslations();
  const [view, setView] = useViewState();
  const stage = useRef<HTMLElement>(null);
  const padding = useStagePadding(stage);

  return (
    <AnalyticsProvider>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          id="overview-panel"
          className="scroll-thin order-2 border-line/60 bg-bg lg:order-1 lg:w-[380px] lg:shrink-0 lg:overflow-y-auto xl:w-[400px]"
        >
          <OverviewPanel />
        </aside>

        <section
          ref={stage}
          id="map-stage"
          aria-label="Map"
          className="map-stage relative order-1 h-[62vh] min-h-[380px] shrink-0 overflow-hidden lg:order-2 lg:my-3 lg:ml-1 lg:h-auto lg:flex-1 lg:rounded-xl"
        >
          <NepalMap padding={padding} />

          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5 sm:p-3">
            <Breadcrumb className="pointer-events-auto" />
            <div className="pointer-events-auto flex items-center gap-2">
              <SearchBox />
              <button
                id="projects-toggle"
                onClick={() => setView({ view: view.view === "projects" ? "overview" : "projects", project: null })}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold uppercase tracking-wider shadow-lg transition-colors",
                  view.view === "projects" ? "bg-teal text-[#0f1a22]" : "bg-bg/90 text-text hover:bg-panel",
                )}
              >
                <span className="hidden sm:inline">{view.view === "projects" ? t("map.overview") : t("map.projects")}</span>
                {view.view === "projects" ? <LayoutGrid className="size-4" /> : <MapPin className="size-4" />}
              </button>
            </div>
          </div>

          <MetricLegend className="pointer-events-auto absolute bottom-3 left-3" />
          <MapControls className="absolute bottom-3 right-3" />
          <MapTooltip />
          <ProjectDrawer />
        </section>

        <RightRail className="order-3 hidden lg:flex" />
      </div>
      <FilterDialog />
      <Tour />
    </AnalyticsProvider>
  );
}
