// Regression: English and Romanized Nepali message files must have the same keys and the same
// {placeholders}; a missing key renders as raw text in the UI.
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ne from "@/messages/ne.json";

type Tree = { [k: string]: string | Tree };
const flat = (t: Tree, prefix = ""): Record<string, string> =>
  Object.fromEntries(
    Object.entries(t).flatMap(([k, v]) => (typeof v === "string" ? [[prefix + k, v]] : Object.entries(flat(v, `${prefix}${k}.`)))),
  );
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

const E = flat(en as Tree);
const N = flat(ne as Tree);

describe("messages", () => {
  it("en and ne have identical keys", () => {
    expect(Object.keys(N).sort()).toEqual(Object.keys(E).sort());
  });
  it("placeholders match in every message", () => {
    const bad = Object.keys(E).filter((k) => N[k] !== undefined && placeholders(E[k]).join() !== placeholders(N[k]).join());
    expect(bad).toEqual([]);
  });
  it("no empty strings", () => {
    expect(Object.entries({ ...E, ...N }).filter(([, v]) => !v.trim())).toEqual([]);
  });
});
