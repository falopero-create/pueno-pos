import { readdir, readFile } from "node:fs/promises";
import pg from "pg";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const url = process.env.DATABASE_URL?.trim() ?? "";
const files = (await readdir("migrations").catch(() => []))
  .filter((f) => f.endsWith(".sql") && !f.includes(".dev."))
  .sort();
if (url === "" || files.length === 0) {
  console.log("migrate: nothing to do");
  process.exit(0);
}
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED?.trim() || url,
});
await client.connect();
try {
  await client.query("set lock_timeout = '60s'");
  await client.query("select pg_advisory_lock(7272741)");
  await client.query(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set(
    (await client.query("select name from schema_migrations")).rows.map(
      (r) => r.name,
    ),
  );
  for (const file of files.filter((f) => !done.has(f))) {
    await client.query("begin");
    try {
      await client.query(await readFile(`migrations/${file}`, "utf8"));
      await client.query("insert into schema_migrations (name) values ($1)", [
        file,
      ]);
      await client.query("commit");
      console.log(`migrate: applied ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }

  // Optional first admin from env (never hardcode credentials in shipped SQL).
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() ?? "";
  if (adminPassword !== "") {
    const { rows } = await client.query("select count(*)::int as n from usuario");
    if (Number(rows[0]?.n ?? 0) === 0) {
      const username = process.env.ADMIN_USERNAME?.trim() || "admin";
      const hash = await bcrypt.hash(adminPassword, 12);
      const suc = await client.query(
        "select uuid_sucursal from sucursal order by id asc limit 1",
      );
      const uuidSucursal = suc.rows[0]?.uuid_sucursal;
      if (!uuidSucursal) {
        throw new Error("migrate: ADMIN_PASSWORD set but no sucursal exists");
      }
      await client.query(
        `insert into usuario (
           uuid_usuario, uuid_sucursal, idtipo_usuario, username, password_hash,
           email, nombre, role, privilegios
         ) values ($1, $2, 1, $3, $4, $5, $6, 'admin', $7)`,
        [
          randomUUID(),
          uuidSucursal,
          username,
          hash,
          `${username.replace(/\s+/g, ".")}@local`,
          "ADMINISTRADOR",
          "vender,descontar,cortar,inventario,usuarios,reportes,config",
        ],
      );
      console.log(`migrate: created initial admin '${username}' from env`);
    }
  }
} finally {
  await client.end();
}
