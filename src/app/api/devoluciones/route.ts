import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { round2 } from "@/lib/money";
import { hasPrivilege } from "@/lib/roles";

type LineIn = {
  uuid_venta_producto: string;
  cantidad: number;
};

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!hasPrivilege(user.role, "vender")) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    uuid_venta?: string;
    motivo?: string;
    lineas?: LineIn[];
    total?: boolean;
  } | null;

  if (!body?.uuid_venta) {
    return NextResponse.json({ error: "Venta requerida" }, { status: 400 });
  }

  const turno = await sql<{ uuid_cortecaja: string }>(
    `SELECT uuid_cortecaja FROM corte_caja
     WHERE uuid_sucursal = $1 AND is_closed = 0 LIMIT 1`,
    [user.uuid_sucursal],
  );
  if (!turno[0]) {
    return NextResponse.json(
      { error: "Necesitás un turno abierto para devolver" },
      { status: 409 },
    );
  }

  const ventas = await sql<{
    uuid_venta: string;
    uuid_cortecaja: string;
    idc_forma_pago: number;
    total: number;
    is_active: number;
  }>(
    `SELECT uuid_venta, uuid_cortecaja, idc_forma_pago, total, is_active
     FROM venta WHERE uuid_venta = $1 AND uuid_sucursal = $2 LIMIT 1`,
    [body.uuid_venta, user.uuid_sucursal],
  );
  const venta = ventas[0];
  if (!venta || venta.is_active !== 1) {
    return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  }

  const lineasDb = await sql<{
    uuid_venta_producto: string;
    uuid_producto: string;
    cantidad: number;
    cantidad_devuelta: number;
    total: number;
    nombre_producto: string;
  }>(
    `SELECT uuid_venta_producto, uuid_producto, cantidad, cantidad_devuelta, total, nombre_producto
     FROM venta_producto WHERE uuid_venta = $1 AND is_active = 1`,
    [body.uuid_venta],
  );

  type RetLine = {
    uuid_venta_producto: string;
    uuid_producto: string;
    cantidad: number;
    total: number;
  };
  const toReturn: RetLine[] = [];

  if (body.total) {
    for (const l of lineasDb) {
      const restante = round2(Number(l.cantidad) - Number(l.cantidad_devuelta));
      if (restante <= 0) continue;
      const unit = Number(l.total) / Number(l.cantidad);
      toReturn.push({
        uuid_venta_producto: l.uuid_venta_producto,
        uuid_producto: l.uuid_producto,
        cantidad: restante,
        total: round2(unit * restante),
      });
    }
  } else {
    if (!body.lineas?.length) {
      return NextResponse.json(
        { error: "Indicá líneas o devolución total" },
        { status: 400 },
      );
    }
    for (const reqLine of body.lineas) {
      const l = lineasDb.find(
        (x) => x.uuid_venta_producto === reqLine.uuid_venta_producto,
      );
      if (!l) {
        return NextResponse.json(
          { error: "Línea de venta inválida" },
          { status: 400 },
        );
      }
      const qty = Number(reqLine.cantidad);
      const restante = round2(Number(l.cantidad) - Number(l.cantidad_devuelta));
      if (!Number.isFinite(qty) || qty <= 0 || qty > restante) {
        return NextResponse.json(
          { error: `Cantidad inválida en ${l.nombre_producto}` },
          { status: 400 },
        );
      }
      const unit = Number(l.total) / Number(l.cantidad);
      toReturn.push({
        uuid_venta_producto: l.uuid_venta_producto,
        uuid_producto: l.uuid_producto,
        cantidad: qty,
        total: round2(unit * qty),
      });
    }
  }

  if (!toReturn.length) {
    return NextResponse.json(
      { error: "Nada por devolver en este ticket" },
      { status: 409 },
    );
  }

  const totalDev = round2(toReturn.reduce((a, l) => a + l.total, 0));
  const uuidDev = randomUUID();

  await sql(
    `INSERT INTO devolucion (
       uuid_devolucion, uuid_venta, uuid_cortecaja, uuid_vendedor, uuid_sucursal,
       motivo, total, fecha
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      uuidDev,
      body.uuid_venta,
      turno[0].uuid_cortecaja,
      user.uuid_usuario,
      user.uuid_sucursal,
      body.motivo?.trim() || "Devolución",
      totalDev,
      new Date().toISOString(),
    ],
  );

  for (const line of toReturn) {
    await sql(
      `INSERT INTO devolucion_producto (
         uuid_devolucion_producto, uuid_devolucion, uuid_venta_producto,
         uuid_producto, cantidad, total
       ) VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        randomUUID(),
        uuidDev,
        line.uuid_venta_producto,
        line.uuid_producto,
        line.cantidad,
        line.total,
      ],
    );
    await sql(
      `UPDATE venta_producto
       SET cantidad_devuelta = cantidad_devuelta + $1
       WHERE uuid_venta_producto = $2`,
      [line.cantidad, line.uuid_venta_producto],
    );
    await sql(
      `UPDATE producto_sucursal
       SET existencia = existencia + $1
       WHERE uuid_producto = $2 AND uuid_sucursal = $3`,
      [line.cantidad, line.uuid_producto, user.uuid_sucursal],
    );
  }

  const allReturned = lineasDb.every((l) => {
    const ret = toReturn.find(
      (t) => t.uuid_venta_producto === l.uuid_venta_producto,
    );
    const nueva = Number(l.cantidad_devuelta) + (ret?.cantidad ?? 0);
    return nueva >= Number(l.cantidad);
  });
  if (allReturned) {
    await sql(`UPDATE venta SET is_active = 0 WHERE uuid_venta = $1`, [
      body.uuid_venta,
    ]);
  }

  const isCash = venta.idc_forma_pago === 1;
  await sql(
    `UPDATE corte_caja SET
       efectivo_cobrado = efectivo_cobrado - $1,
       ingresos_totales = ingresos_totales - $2,
       total_neto = total_neto - $2,
       n_ventas_efectivo = GREATEST(n_ventas_efectivo - $3, 0)
     WHERE uuid_cortecaja = $4`,
    [
      isCash ? totalDev : 0,
      totalDev,
      allReturned && isCash ? 1 : 0,
      turno[0].uuid_cortecaja,
    ],
  );

  return NextResponse.json({
    uuid_devolucion: uuidDev,
    total: totalDev,
    total_devolucion: allReturned,
  });
}
