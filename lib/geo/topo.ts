"use client";
import { feature } from "topojson-client";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { Topology } from "topojson-specification";

export type FC = FeatureCollection<Polygon | MultiPolygon, Record<string, string>>;

const cache = new Map<string, Promise<Topology>>();
const get = (url: string) => {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => r.json()));
  return cache.get(url)!;
};
const fc = (t: Topology, layer: string) => feature(t, t.objects[layer]) as unknown as FC;

export async function loadNepal() {
  const t = await get("/geo/nepal.topo.json");
  return { provinces: fc(t, "provinces"), districts: fc(t, "districts"), nepal: fc(t, "nepal") };
}

export async function loadNeighbours() {
  return fc(await get("/geo/neighbours.topo.json"), "neighbours");
}

export async function loadPalikas(province: string) {
  return fc(await get(`/geo/palikas/${province}.topo.json`), "palikas");
}

/** warm the cache (e.g. on hover of a province) */
export const preloadPalikas = (province: string) => void get(`/geo/palikas/${province}.topo.json`);

export const NEPAL_BOUNDS: [[number, number], [number, number]] = [[80.06, 26.35], [88.2, 30.47]];
