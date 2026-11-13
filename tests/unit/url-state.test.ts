// Regression: a shared link must reproduce exactly the same view (plan §12 "URL state round-trips").
import { describe, expect, it } from "vitest";
import { createLoader, createSerializer } from "nuqs/server";
import { viewParsers, filtersOf, activeFilterCount } from "@/lib/state/url-state";

const serialize = createSerializer(viewParsers);
const load = createLoader(viewParsers);

describe("view URL state", () => {
  it("round-trips every field", () => {
    const view = {
      area: "kathmandu~kathmandu",
      year: 2023,
      partners: ["japan", "adb"],
      sectors: ["transport"],
      status: ["ongoing" as const, "completed" as const],
      flow: ["loan" as const],
      metric: "disbursed" as const,
      view: "projects" as const,
      mode: "3d" as const,
      level: "district" as const,
      tab: "sectors" as const,
      project: "SAMPLE-007",
      cur: "NPR" as const,
    };
    const url = serialize("https://example.org/", view);
    expect(load(new URL(url).searchParams)).toEqual(view);
  });

  it("defaults give a clean link and an unfiltered view", () => {
    const v = load(new URLSearchParams(""));
    expect(serialize("/", v)).toBe("/");
    expect(activeFilterCount(v)).toBe(0);
    expect(filtersOf(v)).toEqual({ year: null, partners: [], sectors: [], status: [], flow: [], areas: [] });
  });

  it("ignores invalid values instead of crashing", () => {
    const v = load(new URLSearchParams("metric=bogus&mode=4d&year=abc&cur=EUR"));
    expect(v.metric).toBe("committed");
    expect(v.mode).toBe("2d");
    expect(v.year).toBeNull();
    expect(v.cur).toBe("USD");
  });
});
