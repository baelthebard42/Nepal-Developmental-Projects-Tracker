"use client";
// The map canvas (plan §6.3). MapLibre with an inline Nepal-only style; choropleth + hover via
// per-feature state; deck.gl (interleaved) for partner arcs and project dots.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map as MapGL, Marker, Source, Layer, useControl, AttributionControl, type MapRef, type MapLayerMouseEvent } from "@vis.gl/react-maplibre";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ArcLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { Layer as DeckLayer, PickingInfo } from "@deck.gl/core";
import type { StyleSpecification, ExpressionSpecification, FilterSpecification } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslations } from "next-intl";
import { useData, useLocalName } from "@/components/providers";
import { PartnerBadge } from "@/components/ui/bits";
import { useA } from "@/components/map/analytics-context";
import { useUI } from "@/lib/state/ui-store";
import { useViewState } from "@/lib/state/url-state";
import { loadNeighbours, loadNepal, loadPalikas, preloadPalikas, NEPAL_BOUNDS, type FC } from "@/lib/geo/topo";
import { ringLayout } from "@/lib/geo/ring";
import { locationShares } from "@/lib/analytics/aggregate";
import { cn } from "@/lib/utils";
import { RAMP, NODATA, CONTEXT } from "@/components/map/NepalMap.colors";

// ---------- colours (plan §5.5) ----------
const STATUS_RGB: Record<string, [number, number, number]> = {
  pipeline: [139, 159, 174],
  ongoing: [78, 190, 202],
  completed: [92, 196, 137],
  suspended: [224, 122, 95],
};

const st = (k: string) => ["feature-state", k] as ExpressionSpecification;
const fillColor: ExpressionSpecification = [
  "case",
  ["==", st("role"), "value"],
  ["case", ["boolean", st("has"), false], ["interpolate", ["linear"], ["number", st("t"), 0], 0, RAMP[0], 0.25, RAMP[1], 0.5, RAMP[2], 0.75, RAMP[3], 1, RAMP[4]], NODATA],
  ["==", st("role"), "context"],
  CONTEXT,
  "rgba(0,0,0,0)",
];
const fillOpacity: ExpressionSpecification = ["case", ["boolean", st("fade"), false], 0.35, 1];
const hoverOpacity: ExpressionSpecification = ["case", ["boolean", st("hover"), false], 0.2, 0];
const hlOpacity: ExpressionSpecification = ["case", ["any", ["boolean", st("hover"), false], ["boolean", st("selected"), false], ["boolean", st("hl"), false]], 1, 0];

const BASE_STYLE = (origin: string): StyleSpecification => ({
  version: 8,
  glyphs: `${origin}/glyphs/{fontstack}/{range}.pbf`,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "rgba(0,0,0,0)" } }],
});

const LEVEL_SOURCE = { province: "provinces", district: "districts", palika: "palikas" } as const;
type LevelKey = keyof typeof LEVEL_SOURCE;

// deck.gl overlay mounted as a MapLibre control (single shared canvas)
function DeckOverlay({ layers, onReady }: { layers: DeckLayer[]; onReady: (o: MapboxOverlay) => void }) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay({ interleaved: true, layers: [] }));
  useEffect(() => onReady(overlay), [overlay, onReady]);
  overlay.setProps({ layers });
  return null;
}

export default function NepalMap({ padding }: { padding: { top: number; bottom: number; left: number; right: number } }) {
  const t = useTranslations();
  const name = useLocalName();
  const { dataset, areas, partners } = useData();
  const a = useA();
  const [view, setView] = useViewState();
  const ui = useUI();
  const mapRef = useRef<MapRef>(null);
  const [ready, setReady] = useState(false);
  const [geo, setGeo] = useState<{ provinces: FC; districts: FC; nepal: FC; neighbours: FC } | null>(null);
  const [palikas, setPalikas] = useState<Record<string, FC>>({});
  const deckPicked = useRef(false);
  const reapply = useRef<ReturnType<typeof setTimeout>>(undefined);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const mapStyle = useMemo(() => BASE_STYLE(origin), [origin]);

  // ---------- load geometry ----------
  useEffect(() => {
    Promise.all([loadNepal(), loadNeighbours()]).then(([n, neighbours]) => setGeo({ ...n, neighbours }));
  }, []);
  const province = a.focus && areas ? areas.provinceOf(a.focus) : undefined;
  useEffect(() => {
    if (province && !palikas[province]) loadPalikas(province).then((fc) => setPalikas((p) => ({ ...p, [province]: fc })));
  }, [province, palikas]);
  const palikaFC = useMemo<FC>(() => ({ type: "FeatureCollection", features: Object.values(palikas).flatMap((f) => f.features) }), [palikas]);

  const focusArea = areas?.get(a.focus);
  const focusDistrict = focusArea?.level === "district" ? focusArea.code : null;
  const activeLevel: LevelKey = a.childLevel;

  // ---------- roles + choropleth values via feature-state ----------
  const roles = useMemo(() => {
    const m: Record<LevelKey, Map<string, { role: "value" | "context" | "none"; t: number; has: boolean }>> = {
      province: new Map(), district: new Map(), palika: new Map(),
    };
    if (!areas || !a.agg) return m;
    const metric = view.metric;
    const val = (code: string) => {
      const x = a.agg!.byArea.get(code);
      return !x ? 0 : metric === "count" ? x.count : metric === "disbursed" ? x.disbursed : x.committed;
    };
    const valueCodes = a.agg.locations.map((r) => r.key);
    const max = Math.max(0, ...valueCodes.map(val));
    const put = (lvl: LevelKey, code: string, role: "value" | "context" | "none") => {
      const v = val(code);
      m[lvl].set(code, { role, t: role === "value" && max > 0 ? Math.sqrt(v / max) : 0, has: v > 0 });
    };
    for (const c of valueCodes) put(activeLevel, c, "value");
    if (focusArea) {
      const prov = areas.provinceOf(focusArea.code)!;
      for (const p of areas.children(null)) if (p.code !== prov) put("province", p.code, "context");
      if (focusArea.level === "district")
        for (const d of areas.children(prov)) if (d.code !== focusArea.code) put("district", d.code, "context");
    }
    return m;
  }, [areas, a.agg, view.metric, activeLevel, focusArea]);

  const applyStates = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !ready) return;
    for (const lvl of Object.keys(LEVEL_SOURCE) as LevelKey[]) {
      const src = LEVEL_SOURCE[lvl];
      if (!map.getSource(src)) continue;
      map.removeFeatureState({ source: src });
      for (const [code, s] of roles[lvl]) map.setFeatureState({ source: src, id: code }, { ...s, selected: code === a.scope && lvl === "palika" });
    }
  }, [roles, ready, a.scope]);
  useEffect(applyStates, [applyStates, palikaFC, geo]);
  const applyRef = useRef(applyStates);
  useEffect(() => {
    applyRef.current = applyStates;
  }, [applyStates]);

  // ---------- hover + linked highlighting ----------
  const prevHover = useRef<{ src: string; id: string } | null>(null);
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !ready || !areas) return;
    if (prevHover.current && map.getSource(prevHover.current.src)) map.setFeatureState({ source: prevHover.current.src, id: prevHover.current.id }, { hover: false });
    prevHover.current = null;
    const ar = areas.get(ui.hoverArea);
    if (ar) {
      const src = LEVEL_SOURCE[ar.level];
      if (map.getSource(src)) {
        map.setFeatureState({ source: src, id: ar.code }, { hover: true });
        prevHover.current = { src, id: ar.code };
      }
    }
  }, [ui.hoverArea, ready, areas, roles]);

  // partners / sectors highlighted (hovered row or flag; or 1–3 selected partners)
  const hlPartners = useMemo(() => (ui.hoverPartner ? [ui.hoverPartner] : view.partners.length && view.partners.length <= 3 ? view.partners : []), [ui.hoverPartner, view.partners]);
  const hlCodes = useMemo(() => {
    const out = new Set<string>();
    if (!a.agg || !areas) return out;
    const valueCodes = roles[activeLevel];
    if (hlPartners.length) {
      for (const [code, s] of valueCodes) if (s.role === "value" && hlPartners.some((p) => (a.agg!.byArea.get(code)?.partners.get(p) ?? 0) > 0)) out.add(code);
    } else if (ui.hoverSector) {
      for (const v of a.projects) if (v.project.sector_code === ui.hoverSector)
        for (const l of locationShares(v.project)) for (const c of areas.lineage(l.code)) if (valueCodes.get(c)?.role === "value") out.add(c);
    }
    return out;
  }, [hlPartners, ui.hoverSector, a.agg, a.projects, areas, roles, activeLevel]);
  const highlighting = hlPartners.length > 0 || !!ui.hoverSector;
  useEffect(() => {
    const map = mapRef.current?.getMap();
    const src = LEVEL_SOURCE[activeLevel];
    if (!map || !ready || !map.getSource(src)) return;
    for (const [code, s] of roles[activeLevel]) {
      if (s.role !== "value") continue;
      map.setFeatureState({ source: src, id: code }, { hl: highlighting && hlCodes.has(code), fade: highlighting && !hlCodes.has(code) });
    }
  }, [hlCodes, highlighting, roles, activeLevel, ready]);

  // ---------- camera ----------
  const fit = useCallback(
    (animate = true) => {
      const map = mapRef.current?.getMap();
      if (!map) return;
      const b = focusArea ? a.scopeArea!.level === "palika" ? areas!.get(a.focus!)!.bbox : focusArea.bbox : null;
      const bounds: [[number, number], [number, number]] = b ? [[b[0], b[1]], [b[2], b[3]]] : NEPAL_BOUNDS;
      const ring = !focusArea && view.view === "overview";
      const pad = ring
        ? padding.left < 20
          ? { top: padding.top + 40, bottom: padding.bottom + 50, left: 70, right: 70 }
          : { top: padding.top + 70, bottom: padding.bottom + 80, left: padding.left + 150, right: padding.right + 150 }
        : { ...padding, bottom: padding.bottom + 40 };
      map.fitBounds(bounds, { padding: pad, duration: animate ? 1200 : 0, pitch: view.mode === "3d" ? 50 : 0, bearing: view.mode === "3d" ? -10 : 0, essential: true, maxZoom: 11 });
    },
    [focusArea, a.scopeArea, a.focus, areas, padding, view.view, view.mode],
  );
  useEffect(() => {
    if (ready) fit(true);
  }, [ready, fit]);

  // ---------- events ----------
  const pick = (e: MapLayerMouseEvent) => e.features?.find((f) => f.state?.role === "value" || f.state?.role === "context");
  const onMove = (e: MapLayerMouseEvent) => {
    if (deckPicked.current) return;
    const f = pick(e);
    const code = (f?.properties?.code as string) ?? null;
    if (code !== ui.hoverArea || code) ui.set({ hoverArea: code, hoverPoint: code ? { x: e.point.x, y: e.point.y } : null });
    if (code && areas?.get(code)?.level === "province") preloadPalikas(code);
    const c = mapRef.current?.getCanvas();
    if (c) c.style.cursor = f ? "pointer" : "";
  };
  const onLeave = () => ui.set({ hoverArea: null, hoverPoint: null });
  const onClick = (e: MapLayerMouseEvent) => {
    if (deckPicked.current) {
      deckPicked.current = false;
      return;
    }
    const f = pick(e);
    const code = f?.properties?.code as string | undefined;
    if (!code || code === a.scope) return;
    ui.set({ hoverArea: null, hoverPoint: null });
    setView({ area: code, project: null });
  };

  // ---------- partner ring + arcs (deck.gl) ----------
  const ring = useMemo(() => ringLayout(dataset.partners), [dataset.partners]);
  const showRing = !a.focus && view.view === "overview" && view.mode === "2d";
  const activePartners = useMemo(() => new Set(a.agg?.partners.filter((p) => p.committed > 0).map((p) => p.key)), [a.agg]);

  const arcs = useMemo(() => {
    if (!showRing || !hlPartners.length || !areas) return [];
    const out: { from: [number, number]; to: [number, number]; w: number }[] = [];
    for (const pid of hlPartners) {
      const from = ring.get(pid);
      if (!from) continue;
      for (const code of hlCodes) {
        const ar = areas.get(code);
        const w = a.agg?.byArea.get(code)?.partners.get(pid) ?? 0;
        if (ar && w > 0) out.push({ from, to: ar.label, w });
      }
    }
    return out;
  }, [showRing, hlPartners, hlCodes, areas, ring, a.agg]);

  const points = useMemo(() => {
    if (view.view !== "projects" || !areas) return [];
    const seen = new Map<string, number>();
    const max = Math.max(1, ...a.projects.map((v) => v.committed));
    return a.projects.flatMap((v) =>
      v.project.locations
        .filter((l) => areas.within(l.area_code, a.scope))
        .map((l) => {
          const ar = areas.get(l.area_code);
          if (!ar) return null;
          const k = seen.get(ar.code) ?? 0;
          seen.set(ar.code, k + 1);
          const ang = k * 2.4;
          const r = k ? 0.035 * Math.sqrt(k) * (ar.level === "province" ? 4 : ar.level === "district" ? 1.6 : 0.5) : 0;
          return { id: v.project.id, status: v.project.status, pos: [ar.label[0] + r * Math.cos(ang), ar.label[1] + r * Math.sin(ang)] as [number, number], size: Math.sqrt(v.committed / max) };
        })
        .filter((x): x is NonNullable<typeof x> => !!x),
    );
  }, [view.view, a.projects, areas, a.scope]);

  type Pt = (typeof points)[number];
  const onPointHover = useCallback((info: PickingInfo<Pt>) => {
    deckPicked.current = !!info.object;
    useUI.getState().set({ hoverProject: info.object?.id ?? null, hoverPoint: info.object ? { x: info.x, y: info.y } : null, hoverArea: null });
  }, []);
  const onPointClick = useCallback(
    (info: PickingInfo<Pt>) => {
      if (!info.object) return false;
      deckPicked.current = true;
      setView({ project: info.object.id });
      return true;
    },
    [setView],
  );

  const deckLayers = useMemo(() => {
    const layers: DeckLayer[] = [];
    if (arcs.length)
      layers.push(
        new ArcLayer({
          id: "partner-arcs",
          data: arcs,
          getSourcePosition: (d) => d.from,
          getTargetPosition: (d) => d.to,
          getSourceColor: [234, 240, 245, 200],
          getTargetColor: [78, 190, 202, 255],
          getWidth: 1.8,
          getHeight: 0.3,
          getTilt: 90,
          greatCircle: false,
        }),
      );
    if (points.length)
      layers.push(
        // handlers only touch the ref when deck.gl fires pointer events, never during render
        // eslint-disable-next-line react-hooks/refs
        new ScatterplotLayer({
          id: "project-points",
          data: points,
          getPosition: (d) => d.pos,
          getRadius: (d) => 4 + d.size * 13,
          radiusUnits: "pixels",
          getFillColor: (d) => [...STATUS_RGB[d.status], ui.hoverProject && ui.hoverProject !== d.id ? 90 : 225] as [number, number, number, number],
          getLineColor: (d) => (ui.hoverProject === d.id ? [255, 255, 255, 255] : [15, 26, 34, 200]),
          getLineWidth: (d) => (ui.hoverProject === d.id ? 2.5 : 1),
          lineWidthUnits: "pixels",
          stroked: true,
          pickable: true,
          updateTriggers: { getFillColor: ui.hoverProject, getLineColor: ui.hoverProject, getLineWidth: ui.hoverProject },
          onHover: onPointHover,
          onClick: onPointClick,
        }),
      );
    return layers;
  }, [arcs, points, ui.hoverProject, onPointHover, onPointClick]);
  const onOverlay = useCallback(() => {}, []);

  // ---------- labels ----------
  const labels = useMemo<FeatureCollection<Point>>(() => {
    if (!areas) return { type: "FeatureCollection", features: [] };
    const codes = [...roles[activeLevel].entries()].filter(([, s]) => s.role === "value").map(([c]) => c);
    return {
      type: "FeatureCollection",
      features: codes.map((c) => {
        const ar = areas.get(c)!;
        return { type: "Feature", geometry: { type: "Point", coordinates: ar.label }, properties: { name: ar.short, code: c } };
      }),
    };
  }, [roles, activeLevel, areas]);

  // readiness marker for end-to-end tests and anyone automating the page
  useEffect(() => {
    if (ready && geo) mapRef.current?.getContainer().setAttribute("data-map-ready", "true");
  }, [ready, geo]);

  // ---------- 3D ----------
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !ready) return;
    // pitch itself is applied by fit() (it depends on view.mode), so the two never fight
    map.dragRotate[view.mode === "3d" ? "enable" : "disable"]();
  }, [view.mode, ready]);

  // ---------- PNG export ----------
  useEffect(() => {
    const onExport = () => {
      const map = mapRef.current?.getMap();
      if (!map) return;
      map.once("render", () => {
        const src = map.getCanvas();
        const out = document.createElement("canvas");
        const W = src.width, H = src.height, s = window.devicePixelRatio || 1;
        out.width = W;
        out.height = H + 64 * s;
        const ctx = out.getContext("2d")!;
        const g = ctx.createRadialGradient(W * 0.55, H * 0.45, 0, W * 0.55, H * 0.45, Math.max(W, H) * 0.7);
        g.addColorStop(0, "#1f5363"); g.addColorStop(1, "#132f3b");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(src, 0, 0);
        ctx.fillStyle = "#16202b";
        ctx.fillRect(0, H, W, 64 * s);
        ctx.fillStyle = "#eaf0f5";
        ctx.font = `600 ${18 * s}px Inter, sans-serif`;
        const where = a.scopeArea ? name(a.scopeArea) : t("scope.allNepal");
        ctx.fillText(`${t("app.title")} · ${where}${view.year ? ` · ${view.year}` : ""}`, 16 * s, H + 28 * s);
        ctx.fillStyle = "#8b9fae";
        ctx.font = `${12 * s}px Inter, sans-serif`;
        const sample = dataset.projects.some((p) => p.is_sample) ? `${t("app.sample")} · ` : "";
        ctx.fillText(`${sample}${t(`metric.${view.metric}`)} · ${new Date().toISOString().slice(0, 10)} · ${window.location.href.slice(0, 120)}`, 16 * s, H + 50 * s);
        const link = document.createElement("a");
        link.download = `nepal-projects-${a.scope ?? "nepal"}.png`;
        link.href = out.toDataURL("image/png");
        link.click();
      });
      map.triggerRepaint();
    };
    window.addEventListener("export-png", onExport);
    return () => window.removeEventListener("export-png", onExport);
  }, [a.scope, a.scopeArea, name, t, view.year, view.metric, dataset.projects]);

  // zoom buttons / reset dispatched from overlay controls
  useEffect(() => {
    const zi = () => mapRef.current?.getMap().zoomIn();
    const zo = () => mapRef.current?.getMap().zoomOut();
    const rf = () => fit(true);
    window.addEventListener("map-zoom-in", zi);
    window.addEventListener("map-zoom-out", zo);
    window.addEventListener("map-refit", rf);
    return () => {
      window.removeEventListener("map-zoom-in", zi);
      window.removeEventListener("map-zoom-out", zo);
      window.removeEventListener("map-refit", rf);
    };
  }, [fit]);

  const lineFilterPalika: FilterSpecification = ["==", ["get", "district"], focusDistrict ?? "__none__"];
  const nationalDistricts = !a.focus && view.level === "district";

  return (
    <MapGL
      ref={mapRef}
      mapStyle={mapStyle}
      initialViewState={{ bounds: [NEPAL_BOUNDS[0][0], NEPAL_BOUNDS[0][1], NEPAL_BOUNDS[1][0], NEPAL_BOUNDS[1][1]], fitBoundsOptions: { padding: 80 } }}
      minZoom={4.6}
      maxZoom={12}
      maxBounds={[66, 14, 104, 40]}
      dragRotate={false}
      pitchWithRotate={false}
      touchPitch={false}
      attributionControl={false}
      interactiveLayerIds={geo ? ["province-fill", "district-fill", "palika-fill"] : []}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      onLoad={(e) => {
        if (process.env.NODE_ENV !== "production") (window as unknown as { __map: unknown }).__map = e.target;
        e.target.on("sourcedata", (ev) => {
          if (ev.isSourceLoaded && ev.sourceDataType !== "metadata" && (ev.sourceId === "provinces" || ev.sourceId === "districts" || ev.sourceId === "palikas")) {
            clearTimeout(reapply.current);
            reapply.current = setTimeout(() => applyRef.current(), 30);
          }
        });
        setReady(true);
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      <AttributionControl compact position="bottom-right" customAttribution="Boundaries: Survey Department, Govt. of Nepal (2020 map) · Neighbours: Natural Earth" />
      {geo && (
        <>
          <Source id="neighbours" type="geojson" data={geo.neighbours}>
            <Layer id="neighbours-fill" type="fill" paint={{ "fill-color": "#0f2530", "fill-opacity": 0.55 }} />
          </Source>
          <Source id="nepal" type="geojson" data={geo.nepal}>
            <Layer id="nepal-shadow" type="line" paint={{ "line-color": "#06121a", "line-width": 22, "line-blur": 22, "line-opacity": 0.55, "line-translate": [0, 8] }} />
            <Layer id="nepal-base" type="fill" paint={{ "fill-color": NODATA }} />
          </Source>
          <Source id="provinces" type="geojson" data={geo.provinces} promoteId="code">
            <Layer id="province-fill" type="fill" paint={{ "fill-color": fillColor, "fill-opacity": fillOpacity, "fill-color-transition": { duration: 400 } }} />
            <Layer id="province-hover" type="fill" paint={{ "fill-color": "#ffffff", "fill-opacity": hoverOpacity }} />
          </Source>
          <Source id="districts" type="geojson" data={geo.districts} promoteId="code">
            <Layer id="district-fill" type="fill" paint={{ "fill-color": fillColor, "fill-opacity": fillOpacity }} />
            <Layer id="district-hover" type="fill" paint={{ "fill-color": "#ffffff", "fill-opacity": hoverOpacity }} />
          </Source>
          <Source id="palikas" type="geojson" data={palikaFC} promoteId="code">
            <Layer id="palika-fill" type="fill" filter={lineFilterPalika} paint={{ "fill-color": fillColor, "fill-opacity": fillOpacity }} />
            <Layer id="palika-hover" type="fill" filter={lineFilterPalika} paint={{ "fill-color": "#ffffff", "fill-opacity": hoverOpacity }} />
            <Layer id="palika-line" type="line" filter={lineFilterPalika} paint={{ "line-color": "#9fb3c2", "line-width": 0.5, "line-opacity": 0.75 }} />
          </Source>
          <Layer
            id="district-line"
            type="line"
            source="districts"
            paint={{
              "line-color": "#a9bccb",
              "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.4, 9, 1.2],
              "line-opacity": !a.focus && !nationalDistricts ? 0.18 : ["case", ["==", st("role"), "value"], 0.6, ["==", st("role"), "context"], 0.12, 0.35],
            }}
          />
          <Layer
            id="province-line"
            type="line"
            source="provinces"
            paint={{ "line-color": "#c9d6e0", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.1, 9, 2.6], "line-opacity": ["case", ["==", st("role"), "context"], 0.3, 0.75] }}
          />
          <Layer id="nepal-outline" type="line" source="nepal" paint={{ "line-color": "#d9f6f9", "line-width": 1.6, "line-opacity": 0.9 }} />
          {(["province", "district", "palika"] as LevelKey[]).map((lvl) => (
            <Layer
              key={lvl}
              id={`${lvl}-hl`}
              type="line"
              source={LEVEL_SOURCE[lvl]}
              {...(lvl === "palika" ? { filter: lineFilterPalika } : {})}
              paint={{ "line-color": "#7fe0ea", "line-width": lvl === "palika" ? 2 : 2.6, "line-opacity": hlOpacity }}
            />
          ))}
          {view.mode === "3d" && (
            <Layer
              id="extrude"
              type="fill-extrusion"
              source={LEVEL_SOURCE[activeLevel]}
              {...(activeLevel === "palika" ? { filter: lineFilterPalika } : {})}
              paint={{
                "fill-extrusion-color": fillColor,
                "fill-extrusion-height": ["case", ["==", st("role"), "value"], ["*", ["number", st("t"), 0], activeLevel === "province" ? 90000 : activeLevel === "district" ? 45000 : 14000], 0],
                "fill-extrusion-opacity": 0.92,
                "fill-extrusion-height-transition": { duration: 600 },
              }}
            />
          )}
          <Source id="labels" type="geojson" data={labels}>
            <Layer
              id="labels"
              type="symbol"
              layout={{
                "text-field": ["get", "name"],
                "text-font": ["Noto Sans Medium"],
                "text-size": activeLevel === "province" ? 14 : activeLevel === "district" ? (nationalDistricts ? 10 : 12) : 10.5,
                "text-max-width": 7,
                "text-padding": 3,
                "text-letter-spacing": activeLevel === "province" ? 0.04 : 0,
              }}
              paint={{ "text-color": "#f2f7fa", "text-halo-color": "#0d1b24", "text-halo-width": 1.4, "text-halo-blur": 0.5, "text-opacity": view.mode === "3d" ? 0 : 1 }}
            />
          </Source>
        </>
      )}
      <DeckOverlay layers={deckLayers} onReady={onOverlay} />
      {showRing &&
        dataset.partners.map((p) => {
          const pos = ring.get(p.id);
          if (!pos) return null;
          const on = activePartners.has(p.id);
          const sel = view.partners.includes(p.id);
          return (
            <Marker key={p.id} longitude={pos[0]} latitude={pos[1]} anchor="center">
              <button
                data-ring-partner={p.id}
                aria-label={name(partners.get(p.id))}
                onMouseEnter={() => ui.set({ hoverPartner: p.id })}
                onMouseLeave={() => ui.set({ hoverPartner: null })}
                onFocus={() => ui.set({ hoverPartner: p.id })}
                onBlur={() => ui.set({ hoverPartner: null })}
                onClick={() => setView({ partners: sel ? view.partners.filter((x) => x !== p.id) : [...view.partners, p.id] })}
                className={cn(
                  "group relative flex flex-col items-center transition-all duration-300",
                  on ? "opacity-100" : "opacity-30",
                  (ui.hoverPartner === p.id || sel) && "scale-125",
                )}
              >
                <span className={cn("rounded-full p-[3px] transition-colors", sel ? "bg-teal" : "bg-transparent group-hover:bg-teal/70")}>
                  <PartnerBadge partner={p} size={padding.left < 20 ? 22 : 30} />
                </span>
                <span className="pointer-events-none absolute top-full mt-1 whitespace-nowrap rounded bg-bg/90 px-1.5 py-0.5 text-[11px] font-semibold text-text opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {name(p)}
                </span>
              </button>
            </Marker>
          );
        })}
    </MapGL>
  );
}
