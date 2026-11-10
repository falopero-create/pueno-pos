import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { round2 } from "@/lib/money";
import { hasPrivilege } from "@/lib/roles";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!hasPrivilege(user.role, "cortar")) {
    return NextResponse.json(
      { error: "Sin privilegio para cerrar caja (Supervisor/Admin)" },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    efectivo_contado?: number;
    comentario?: string;
  } | null;

  const efectivoContado = Number(body?.efectivo_contado);
  if (!Number.isFinite(efectivoContado) || efectivoContado < 0) {
    return NextResponse.json(
      { error: "Indicá el efectivo contado en caja" },
      { status: 400 },
    );
  }

  const open = await sql<{
    uuid_cortecaja: string;
    monto_inicial: number;
    efectivo_cobrado: number;
    tarjetas_debito: number;
    tarjetas_credito: number;
    transferencias: number;
    total_credito: number;
    ingresos_totales: number;
    egresos_totales: number;
    devoluciones_efectivo: number;
  }>(
    `SELECT uuid_cortecaja, monto_inicial, efectivo_cobrado, tarjetas_debito,
            tarjetas_credito, transferencias, total_credito, ingresos_totales,
            egresos_totales,
            COALESCE(
              (SELECT SUM(d.total) FROM devolucion d
               WHERE d.uuid_cortecaja = corte_caja.uuid_cortecaja), 0
            ) AS devoluciones_efectivo
     FROM corte_caja
     WHERE uuid_sucursal = $1 AND is_closed = 0
     LIMIT 1`,
    [user.uuid_sucursal],
  );
  const turno = open[0];
  if (!turno) {
    return NextResponse.json({ error: "No hay turno abierto" }, { status: 409 });
  }

  const esperado = round2(
    Number(turno.monto_inicial) +
      Number(turno.efectivo_cobrado) -
      Number(turno.devoluciones_efectivo || 0),
  );
  const diferencia = round2(efectivoContado - esperado);
  const totalNeto = round2(
    Number(turno.ingresos_totales) - Number(turno.egresos_totales || 0),
  );

  await sql(
    `UPDATE corte_caja SET
       f_cerrar = $1,
       is_closed = 1,
       uuid_supervisor = $2,
       total_efectivo = $3,
       diferencia = $4,
       total_neto = $5,
       egresos_totales = egresos_totales + $6
     WHERE uuid_cortecaja = $7`,
    [
      new Date().toISOString(),
      user.uuid_usuario,
      esperado,
      diferencia,
      totalNeto,
      Number(turno.devoluciones_efectivo || 0),
      turno.uuid_cortecaja,
    ],
  );

  // cancel pending holds for this corte
  await sql(
    `UPDATE venta_espera SET vendido = 1, f_update = $1
     WHERE uuid_cortecaja = $2 AND vendido = 0`,
    [new Date().toISOString(), turno.uuid_cortecaja],
  );

  return NextResponse.json({
    uuid_cortecaja: turno.uuid_cortecaja,
    efectivo_esperado: esperado,
    efectivo_contado: efectivoContado,
    diferencia,
    resumen: {
      monto_inicial: Number(turno.monto_inicial),
      efectivo_cobrado: Number(turno.efectivo_cobrado),
      tarjetas:
        Number(turno.tarjetas_debito) + Number(turno.tarjetas_credito),
      transferencias: Number(turno.transferencias),
      devoluciones: Number(turno.devoluciones_efectivo || 0),
      ingresos_totales: Number(turno.ingresos_totales),
    },
  });
}
