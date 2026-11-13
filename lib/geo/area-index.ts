import type { Area } from "@/lib/data/types";

/** Lookup helpers over public/geo/areas.json. Codes: P1..P7, district slug, palika "district~slug[~kind]". */
export class AreaIndex {
  readonly byCode = new Map<string, Area>();
  private kids = new Map<string | null, Area[]>();
  private anc = new Map<string, string[]>();

  constructor(readonly areas: Area[]) {
    for (const a of areas) {
      this.byCode.set(a.code, a);
      const k = this.kids.get(a.parent) ?? [];
      k.push(a);
      this.kids.set(a.parent, k);
    }
  }

  get(code: string | null | undefined) {
    return code ? this.byCode.get(code) : undefined;
  }

  /** self + ancestors, nearest first: [palika, district, province] */
  lineage(code: string): string[] {
    let l = this.anc.get(code);
    if (!l) {
      l = [];
      let c: string | null | undefined = code;
      while (c) {
        l.push(c);
        c = this.byCode.get(c)?.parent;
      }
      this.anc.set(code, l);
    }
    return l;
  }

  /** is `code` equal to or inside `scope` (null scope = all Nepal) */
  within(code: string, scope: string | null) {
    return scope === null || this.lineage(code).includes(scope);
  }

  children(code: string | null): Area[] {
    return this.kids.get(code) ?? [];
  }

  provinceOf(code: string): string | undefined {
    return this.lineage(code).at(-1);
  }

  /** breadcrumb from province down to `code` */
  path(code: string | null): Area[] {
    if (!code) return [];
    return this.lineage(code).map((c) => this.byCode.get(c)!).filter(Boolean).reverse();
  }
}
