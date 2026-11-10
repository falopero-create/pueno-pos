import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { hasPrivilege } from "@/lib/roles";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const rows = await sql<{
    uuid_categoria: string;
    nombre_categoria: string;
    uuid_departamento: string;
    is_active: number;
  }>(
    `SELECT uuid_categoria, nombre_categoria, uuid_departamento, is_active
     FROM categoria WHERE is_active = 1 ORDER BY nombre_categoria`,
  );
  return NextResponse.json({ categorias: rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!hasPrivilege(user.role, "inventario")) {
    return NextResponse.json({ error: "Sin privilegio de inventario" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    nombre_categoria?: string;
    uuid_departamento?: string;
  } | null;
  const nombre = body?.nombre_categoria?.trim();
  if (!nombre) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  }

  let dep = body?.uuid_departamento;
  if (!dep) {
    const d = await sql<{ uuid_departamento: string }>(
      `SELECT uuid_departamento FROM departamento LIMIT 1`,
    );
    dep = d[0]?.uuid_departamento;
  }
  if (!dep) {
    return NextResponse.json({ error: "Sin departamento" }, { status: 400 });
  }

  const uuid = randomUUID();
  await sql(
    `INSERT INTO categoria (uuid_categoria, uuid_departamento, nombre_categoria, is_active)
     VALUES ($1,$2,$3,1)`,
    [uuid, dep, nombre],
  );
  return NextResponse.json({ uuid_categoria: uuid, nombre_categoria: nombre });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!hasPrivilege(user.role, "inventario")) {
    return NextResponse.json({ error: "Sin privilegio de inventario" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    uuid_categoria?: string;
    nombre_categoria?: string;
    is_active?: number;
  } | null;
  if (!body?.uuid_categoria) {
    return NextResponse.json({ error: "uuid_categoria requerido" }, { status: 400 });
  }
  if (body.nombre_categoria?.trim()) {
    await sql(
      `UPDATE categoria SET nombre_categoria = $1 WHERE uuid_categoria = $2`,
      [body.nombre_categoria.trim(), body.uuid_categoria],
    );
  }
  if (typeof body.is_active === "number") {
    await sql(`UPDATE categoria SET is_active = $1 WHERE uuid_categoria = $2`, [
      body.is_active,
      body.uuid_categoria,
    ]);
  }
  return NextResponse.json({ ok: true });
}
