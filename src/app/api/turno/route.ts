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

  const open = await sql<{
    uuid_cortecaja: string;
    uuid_caja: string;
    clavecaja: string;
    f_abrir: string;
    monto_inicial: number;
    efectivo_cobrado: number;
    ingresos_totales: number;
    n_ventas_efectivo: number;
    n_ventas_otros: number;
  }>(
    `SELECT c.uuid_cortecaja, c.uuid_caja, ca.clavecaja, c.f_abrir, c.monto_inicial,
            c.efectivo_cobrado, c.ingresos_totales, c.n_ventas_efectivo, c.n_ventas_otros
     FROM corte_caja c
     JOIN caja ca ON ca.uuid_caja = c.uuid_caja
     WHERE c.uuid_sucursal = $1 AND c.is_closed = 0
     ORDER BY c.f_abrir DESC
     LIMIT 1`,
    [user.uuid_sucursal],
  );

  const cajas = await sql<{ uuid_caja: string; clavecaja: string }>(
    `SELECT uuid_caja, clavecaja FROM caja WHERE uuid_sucursal = $1 AND is_active = 1`,
    [user.uuid_sucursal],
  );

  return NextResponse.json({ turno: open[0] ?? null, cajas });
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
    uuid_caja?: string;
    monto_inicial?: number;
  } | null;

  const existing = await sql<{ uuid_cortecaja: string }>(
    `SELECT uuid_cortecaja FROM corte_caja
     WHERE uuid_sucursal = $1 AND is_closed = 0 LIMIT 1`,
    [user.uuid_sucursal],
  );
  if (existing[0]) {
    return NextResponse.json(
      { error: "Ya hay un turno abierto" },
      { status: 409 },
    );
  }

  let uuidCaja = body?.uuid_caja;
  if (!uuidCaja) {
    const cajas = await sql<{ uuid_caja: string }>(
      `SELECT uuid_caja FROM caja WHERE uuid_sucursal = $1 AND is_active = 1 LIMIT 1`,
      [user.uuid_sucursal],
    );
    uuidCaja = cajas[0]?.uuid_caja;
  }
  if (!uuidCaja) {
    return NextResponse.json({ error: "No hay caja configurada" }, { status: 400 });
  }

  const monto = Number(body?.monto_inicial ?? 0);
  if (!Number.isFinite(monto) || monto < 0) {
    return NextResponse.json({ error: "Monto inicial inválido" }, { status: 400 });
  }

  const uuid = randomUUID();
  await sql(
    `INSERT INTO corte_caja (
       uuid_cortecaja, uuid_caja, uuid_vendedor, uuid_supervisor,
       uuid_sucursal, uuid_empresa, f_abrir, monto_inicial, is_closed
     ) VALUES ($1,$2,$3,$3,$4,$5,$6,$7,0)`,
    [
      uuid,
      uuidCaja,
      user.uuid_usuario,
      user.uuid_sucursal,
      user.uuid_empresa,
      new Date().toISOString(),
      monto,
    ],
  );

  return NextResponse.json({ uuid_cortecaja: uuid });
}
