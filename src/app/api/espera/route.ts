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

  const turno = await sql<{ uuid_cortecaja: string }>(
    `SELECT uuid_cortecaja FROM corte_caja
     WHERE uuid_sucursal = $1 AND is_closed = 0 LIMIT 1`,
    [user.uuid_sucursal],
  );
  if (!turno[0]) {
    return NextResponse.json({ esperas: [] });
  }

  const rows = await sql<{
    uuid_venta_espera: string;
    n_ticket: string;
    json_payload: string;
    f_alta: string;
    vendedor: string;
  }>(
    `SELECT e.uuid_venta_espera, e.n_ticket, e.json_payload, e.f_alta, u.nombre AS vendedor
     FROM venta_espera e
     JOIN usuario u ON u.uuid_usuario = e.uuid_vendedor
     WHERE e.uuid_cortecaja = $1 AND e.vendido = 0
     ORDER BY e.f_alta DESC`,
    [turno[0].uuid_cortecaja],
  );

  return NextResponse.json({
    esperas: rows.map((r) => ({
      ...r,
      payload: JSON.parse(r.json_payload) as unknown,
    })),
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!hasPrivilege(user.role, "vender")) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    payload?: unknown;
    etiqueta?: string;
  } | null;
  if (!body?.payload) {
    return NextResponse.json({ error: "Payload requerido" }, { status: 400 });
  }

  const turno = await sql<{ uuid_cortecaja: string }>(
    `SELECT uuid_cortecaja FROM corte_caja
     WHERE uuid_sucursal = $1 AND is_closed = 0 LIMIT 1`,
    [user.uuid_sucursal],
  );
  if (!turno[0]) {
    return NextResponse.json({ error: "Abrí un turno primero" }, { status: 409 });
  }

  const count = await sql<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM venta_espera WHERE uuid_sucursal = $1`,
    [user.uuid_sucursal],
  );
  const nTicket =
    body.etiqueta?.trim() ||
    `E-${String((count[0]?.c ?? 0) + 1).padStart(4, "0")}`;
  const uuid = randomUUID();

  await sql(
    `INSERT INTO venta_espera (
       uuid_venta_espera, n_ticket, uuid_cortecaja, uuid_vendedor, uuid_sucursal,
       json_payload, vendido, f_alta
     ) VALUES ($1,$2,$3,$4,$5,$6,0,$7)`,
    [
      uuid,
      nTicket,
      turno[0].uuid_cortecaja,
      user.uuid_usuario,
      user.uuid_sucursal,
      JSON.stringify(body.payload),
      new Date().toISOString(),
    ],
  );

  return NextResponse.json({ uuid_venta_espera: uuid, n_ticket: nTicket });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  await sql(
    `UPDATE venta_espera SET vendido = 1, f_update = $1
     WHERE uuid_venta_espera = $2 AND uuid_sucursal = $3 AND vendido = 0`,
    [new Date().toISOString(), id, user.uuid_sucursal],
  );
  return NextResponse.json({ ok: true });
}
