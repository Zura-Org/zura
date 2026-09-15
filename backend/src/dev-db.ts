/**
 * Local development only: runs an embedded PostgreSQL on :54329 so the stack works without Docker or Supabase.
 * Data persists in backend/.local-pg.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".local-pg");

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 54329,
  persistent: true,
});

async function main() {
  if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase("zura");
  } catch {
    // already exists
  }
  console.log("local postgres ready: postgresql://postgres:postgres@localhost:54329/zura");
  setInterval(() => {}, 1 << 30);
}

async function shutdown() {
  await pg.stop().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
