"use client";
import { useEffect, useMemo, useState } from "react";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import type { Topology } from "topojson-specification";

type F = Feature<Polygon | MultiPolygon, { code: string; province?: string }>;

let topoPromise: Promise<{ districts: F[]; provinces: F[] }> | null = null;
const loadTopo = () =>
  (topoPromise ??= fetch("/geo/nepal.topo.json")
    .then((r) => r.json())
    .then((t: Topology) => ({
      districts: (feature(t, t.objects.districts) as unknown as FeatureCollection<Polygon | MultiPolygon, { code: string; province: string }>).features,
      provinces: (feature(t, t.objects.provinces) as unknown as FeatureCollection<Polygon | MultiPolygon, { code: string }>).features,
    })));

const W = 400;
const KX = Math.cos((28 * Math.PI) / 180);
const [LNG0, LNG1, LAT0, LAT1] = [80.0, 88.25, 26.3, 30.5];
const SCALE = W / ((LNG1 - LNG0) * KX);
const H = Math.round((LAT1 - LAT0) * SCALE);

const pt = ([x, y]: Position) => `${((x - LNG0) * KX * SCALE).toFixed(1)},${((LAT1 - y) * SCALE).toFixed(1)}`;
function pathOf(g: Polygon | MultiPolygon) {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.map((p) => p.map((ring) => "M" + ring.map(pt).join("L") + "Z").join("")).join("");
}

/** Lightweight SVG locator map: highlights the districts a project touches. */
export function MiniMap({ codes, nationwide, label }: { codes: string[]; nationwide: boolean; label: string }) {
  const [geo, setGeo] = useState<{ districts: F[]; provinces: F[] } | null>(null);
  useEffect(() => {
    loadTopo().then(setGeo).catch(() => setGeo(null));
  }, []);

  const hi = useMemo(() => {
    const set = new Set<string>();
    for (const c of codes) {
      if (/^P\d$/.test(c)) geo?.districts.filter((d) => d.properties.province === c).forEach((d) => set.add(d.properties.code));
      else set.add(c.split("~")[0]); // palika code -> parent district slug
    }
    return set;
  }, [codes, geo]);

  return (
    <figure className="overflow-hidden rounded-xl border border-l-border bg-[#eef3f6]">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full">
        {geo ? (
          <>
            {geo.districts.map((d) => {
              const on = nationwide || hi.has(d.properties.code);
              return (
                <path
                  key={d.properties.code}
                  d={pathOf(d.geometry)}
                  fill={on ? (nationwide ? "#8fd3db" : "#23808e") : "#d5dfe6"}
                  stroke="#ffffff"
                  strokeWidth={0.5}
                />
              );
            })}
            {geo.provinces.map((p) => (
              <path key={p.properties.code} d={pathOf(p.geometry)} fill="none" stroke="#6c8191" strokeWidth={0.9} strokeLinejoin="round" />
            ))}
          </>
        ) : (
          <rect width={W} height={H} fill="#e3eaef" />
        )}
      </svg>
    </figure>
  );
}
