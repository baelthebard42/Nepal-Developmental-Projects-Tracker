// Partner ring (plan §6.3): each bilateral partner sits on an ellipse around Nepal at the compass
// bearing from Kathmandu to its capital; multilaterals are spread along the lower arc.
import type { Partner } from "@/lib/data/types";

const KTM: [number, number] = [85.32, 27.7];
export const RING_CENTER: [number, number] = [84.13, 28.4];
const RX = 5.25; // degrees of longitude
const RY = 2.85; // degrees of latitude

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function bearing([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const y = Math.sin(rad(lng2 - lng1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lng2 - lng1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** angle (compass degrees) -> lng/lat on the ellipse */
export function ringPoint(angle: number): [number, number] {
  return [RING_CENTER[0] + RX * Math.sin(rad(angle)), RING_CENTER[1] + RY * Math.cos(rad(angle))];
}

/** spread angles so no two are closer than `minGap` degrees (iterative relaxation on a circle) */
function spread(items: { id: string; angle: number }[], minGap: number) {
  const a = [...items].sort((x, y) => x.angle - y.angle);
  for (let iter = 0; iter < 200; iter++) {
    let moved = false;
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length;
      let gap = a[j].angle - a[i].angle;
      if (j === 0) gap += 360;
      if (gap < minGap) {
        const push = (minGap - gap) / 2;
        a[i].angle = (a[i].angle - push + 360) % 360;
        a[j].angle = (a[j].angle + push) % 360;
        moved = true;
      }
    }
    if (!moved) break;
    a.sort((x, y) => x.angle - y.angle);
  }
  return a;
}

export function ringLayout(partners: Partner[]): Map<string, [number, number]> {
  const bilateral = partners.filter((p) => p.type === "bilateral" || p.id === "eu");
  const multi = partners.filter((p) => !(p.type === "bilateral" || p.id === "eu"));
  // multilaterals on the lower arc (south-west to south-east)
  const multiItems = multi.map((p, i) => ({ id: p.id, angle: 205 - (i * 50) / Math.max(1, multi.length - 1) - 0 }));
  const items = [
    ...bilateral.map((p) => ({ id: p.id, angle: bearing(KTM, p.hq) })),
    ...multiItems.map((m) => ({ ...m, angle: 155 + ((205 - m.angle) / 50) * 50 })),
  ];
  const n = items.length;
  const out = new Map<string, [number, number]>();
  for (const it of spread(items, Math.min(22, 300 / n))) out.set(it.id, ringPoint(it.angle));
  return out;
}
