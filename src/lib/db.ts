import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
let pool: pg.Pool | undefined;

type GlobalDb = typeof globalThis & {
  __puenoPool?: pg.Pool;
  __puenoLocal?: Promise<PGlite>;
};

const g = globalThis as GlobalDb;

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl !== "") {
    pool ??= g.__puenoPool ?? new pg.Pool({ connectionString: databaseUrl, max: 5 });
    g.__puenoPool = pool;
    return (await pool.query(text, params)).rows as T[];
  }
  g.__puenoLocal ??= startLocal().catch((error: unknown) => {
    g.__puenoLocal = undefined;
    throw error;
  });
  return (await (await g.__puenoLocal).query<T>(text, params)).rows;
}

async function startLocal(): Promise<PGlite> {
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  await mkdir(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const done = new Set(
    (
      await db.query<{ name: string }>(`SELECT name FROM schema_migrations`)
    ).rows.map((r) => r.name),
  );
  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = (await readdir(migrationsDir).catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (done.has(file)) continue;
    await db.exec(await readFile(path.join(migrationsDir, file), "utf8"));
    await db.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file]);
  }
  return db;
}
