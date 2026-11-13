// Applies supabase/migrations/*.sql in order (each file is idempotent).  npm run db:migrate
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { pgConfig } from "./env";

async function main() {
  const dir = path.resolve(__dirname, "../../supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const c = new Client(pgConfig());
  await c.connect();
  try {
    for (const f of files) {
      process.stdout.write(`→ ${f} … `);
      await c.query("begin");
      await c.query(fs.readFileSync(path.join(dir, f), "utf8"));
      await c.query("commit");
      console.log("ok");
    }
    await c.query("notify pgrst, 'reload schema'");
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}
main().catch((e) => {
  console.error("migration failed:", e.message);
  process.exit(1);
});
