// Tolerant .env reader: ignores malformed multi-line values, allows "KEY =value".
import fs from "node:fs";
import path from "node:path";
import type { ClientConfig } from "pg";

export function readEnv(file = path.resolve(__dirname, "../../.env")): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return { ...out, ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v != null)) as Record<string, string> };
}

/** Parse postgres URL by hand so passwords with unescaped "@" or ":" still work. */
export function pgConfig(): ClientConfig {
  const env = readEnv();
  const url = env.SUPABASE_DB_CONNECTION_STR || env.DATABASE_URL;
  if (!url) throw new Error("SUPABASE_DB_CONNECTION_STR missing in .env");
  const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@/:]+)(?::(\d+))?\/([^?]+)/);
  if (!m) throw new Error("Could not parse SUPABASE_DB_CONNECTION_STR");
  const [, user, password, host, port, database] = m;
  return {
    user: decodeURIComponent(user),
    password: (() => { try { return decodeURIComponent(password); } catch { return password; } })(),
    host, port: Number(port || 5432), database,
    // local/CI test databases (Postgres service container) don't speak SSL; Supabase requires it
    ssl: /^(localhost|127\.0\.0\.1|postgres)$/.test(host) || /sslmode=disable/.test(url) ? false : { rejectUnauthorized: false },
  };
}
