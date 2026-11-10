import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { sql } from "./db";

const ADMIN_PRIVS =
  "vender,descontar,cortar,inventario,usuarios,reportes,config";

export async function countUsers(): Promise<number> {
  const rows = await sql<{ n: string | number }>(
    `SELECT COUNT(*)::int AS n FROM usuario`,
  );
  return Number(rows[0]?.n ?? 0);
}

export async function needsInitialSetup(): Promise<boolean> {
  return (await countUsers()) === 0;
}

/** Create the first admin when the database has no users yet. */
export async function createInitialAdmin(input: {
  username: string;
  password: string;
  nombre?: string;
  email?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const username = input.username.trim();
  const password = input.password;
  if (username.length < 2) {
    return { ok: false, error: "Usuario demasiado corto" };
  }
  if (password.length < 5) {
    return { ok: false, error: "La contraseña debe tener al menos 5 caracteres" };
  }
  if ((await countUsers()) > 0) {
    return { ok: false, error: "Ya existe un administrador" };
  }

  const sucursales = await sql<{ uuid_sucursal: string }>(
    `SELECT uuid_sucursal FROM sucursal ORDER BY id ASC LIMIT 1`,
  );
  const sucursal = sucursales[0]?.uuid_sucursal;
  if (!sucursal) {
    return { ok: false, error: "No hay sucursal configurada" };
  }

  const hash = await bcrypt.hash(password, 12);
  const uuid = randomUUID();
  const nombre = (input.nombre?.trim() || "ADMINISTRADOR").toUpperCase();
  const email =
    input.email?.trim() || `${username.replace(/\s+/g, ".")}@local`;

  await sql(
    `INSERT INTO usuario (
       uuid_usuario, uuid_sucursal, idtipo_usuario, username, password_hash,
       email, nombre, role, privilegios
     ) VALUES ($1, $2, 1, $3, $4, $5, $6, 'admin', $7)`,
    [uuid, sucursal, username, hash, email, nombre, ADMIN_PRIVS],
  );
  return { ok: true };
}
