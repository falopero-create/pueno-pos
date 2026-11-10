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
    .filter((f) => f.endsWith(".sql") && !f.includes(".dev."))
    .sort();
  for (const file of files) {
    if (done.has(file)) continue;
    await db.exec(await readFile(path.join(migrationsDir, file), "utf8"));
    await db.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file]);
  }
  // Local-only optional demo users: require ALLOW_DEMO_SEED=1 and DEMO_PASSWORD
  // from the environment (never hardcoded). Skipped when DATABASE_URL is set.
  await maybeSeedLocalDemo(db);
  return db;
}

async function maybeSeedLocalDemo(db: PGlite): Promise<void> {
  if (process.env.ALLOW_DEMO_SEED?.trim() !== "1") return;
  const demoPassword = process.env.DEMO_PASSWORD?.trim() ?? "";
  if (demoPassword === "") return;
  const count = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM usuario`,
  );
  if (Number(count.rows[0]?.n ?? 0) > 0) return;

  const bcrypt = (await import("bcryptjs")).default;
  const hash = await bcrypt.hash(demoPassword, 12);
  const suc = await db.query<{ uuid_sucursal: string }>(
    `SELECT uuid_sucursal FROM sucursal ORDER BY id ASC LIMIT 1`,
  );
  const uuidSucursal = suc.rows[0]?.uuid_sucursal;
  if (!uuidSucursal) return;

  const users = [
    {
      uuid: "usr-admin-001",
      username: "admin",
      role: "admin",
      tipo: 1,
      nombre: "ADMINISTRADOR",
      priv: "vender,descontar,cortar,inventario,usuarios,reportes,config",
    },
    {
      uuid: "usr-super-001",
      username: "supervisor",
      role: "supervisor",
      tipo: 2,
      nombre: "SUPERVISOR",
      priv: "vender,descontar,cortar,inventario,reportes",
    },
    {
      uuid: "usr-caja-001",
      username: "cajero",
      role: "cajero",
      tipo: 3,
      nombre: "CAJERO",
      priv: "vender",
    },
  ];
  for (const u of users) {
    await db.query(
      `INSERT INTO usuario (
         uuid_usuario, uuid_sucursal, idtipo_usuario, username, password_hash,
         email, nombre, role, privilegios
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (uuid_usuario) DO NOTHING`,
      [
        u.uuid,
        uuidSucursal,
        u.tipo,
        u.username,
        hash,
        `${u.username}@local`,
        u.nombre,
        u.role,
        u.priv,
      ],
    );
  }
}
