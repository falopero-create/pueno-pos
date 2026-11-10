import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { sql } from "./db";
import type { Role } from "./roles";
import type { SessionUser } from "./types";

export type { SessionUser } from "./types";

const COOKIE = "pueno_session";
const SESSION_HOURS = 12;

export async function login(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const rows = await sql<{
    uuid_usuario: string;
    username: string;
    nombre: string;
    role: Role;
    password_hash: string;
    uuid_sucursal: string;
    nombre_sucursal: string;
    uuid_empresa: string;
    nombre_empresa: string;
  }>(
    `SELECT u.uuid_usuario, u.username, u.nombre, u.role, u.password_hash,
            u.uuid_sucursal, s.nombre_sucursal, s.uuid_empresa, e.nombre_empresa
     FROM usuario u
     JOIN sucursal s ON s.uuid_sucursal = u.uuid_sucursal
     JOIN empresa e ON e.uuid_empresa = s.uuid_empresa
     WHERE lower(u.username) = lower($1) AND u.is_active = 1
     LIMIT 1`,
    [username.trim()],
  );
  const user = rows[0];
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;

  const token = randomUUID();
  const expires = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await sql(
    `INSERT INTO session (token, uuid_usuario, expires_at) VALUES ($1, $2, $3)`,
    [token, user.uuid_usuario, expires.toISOString()],
  );

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });

  return {
    uuid_usuario: user.uuid_usuario,
    username: user.username,
    nombre: user.nombre,
    role: user.role,
    uuid_sucursal: user.uuid_sucursal,
    nombre_sucursal: user.nombre_sucursal,
    uuid_empresa: user.uuid_empresa,
    nombre_empresa: user.nombre_empresa,
  };
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await sql(`DELETE FROM session WHERE token = $1`, [token]);
    jar.delete(COOKIE);
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const rows = await sql<{
    uuid_usuario: string;
    username: string;
    nombre: string;
    role: Role;
    uuid_sucursal: string;
    nombre_sucursal: string;
    uuid_empresa: string;
    nombre_empresa: string;
    expires_at: string;
  }>(
    `SELECT u.uuid_usuario, u.username, u.nombre, u.role,
            u.uuid_sucursal, s.nombre_sucursal, s.uuid_empresa, e.nombre_empresa,
            sess.expires_at
     FROM session sess
     JOIN usuario u ON u.uuid_usuario = sess.uuid_usuario
     JOIN sucursal s ON s.uuid_sucursal = u.uuid_sucursal
     JOIN empresa e ON e.uuid_empresa = s.uuid_empresa
     WHERE sess.token = $1 AND u.is_active = 1
     LIMIT 1`,
    [token],
  );
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await sql(`DELETE FROM session WHERE token = $1`, [token]);
    return null;
  }
  return {
    uuid_usuario: row.uuid_usuario,
    username: row.username,
    nombre: row.nombre,
    role: row.role,
    uuid_sucursal: row.uuid_sucursal,
    nombre_sucursal: row.nombre_sucursal,
    uuid_empresa: row.uuid_empresa,
    nombre_empresa: row.nombre_empresa,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
