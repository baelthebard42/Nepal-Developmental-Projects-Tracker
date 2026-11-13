import "server-only";
import seed from "@/supabase/seed/sample_projects.json";
import type { Dataset } from "./types";
import { loadFromSupabase } from "./supabase-dataset";

/**
 * Loads the whole dataset once (plan §8 "Loading"). With Supabase configured it reads the
 * `project_dataset` view (cached 300 s by Next's fetch cache); otherwise, or if Supabase is
 * unreachable/paused, it falls back to the bundled sample JSON so the map always works.
 */
export async function getDataset(): Promise<Dataset> {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY) {
    try {
      const ds = await loadFromSupabase();
      if (ds.projects.length) return ds;
    } catch (e) {
      console.warn("[dataset] Supabase unavailable, using bundled sample data:", (e as Error).message);
    }
  }
  return seed as unknown as Dataset;
}
