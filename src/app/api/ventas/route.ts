import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { round2, splitTaxIncluded } from "@/lib/money";
import { hasPrivilege } from "@/lib/roles";

type LineIn = {
  uuid_producto: string;
  cantidad: number;
  descuento?: number;
};

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const rows = await sql<{
    uuid_venta: string;
    n_ticket: string;
    total: number;
    descuento: number;
    forma_pago: string | null;
    f_alta: string;
    razon_social: string;
    vendedor: string;
    is_active: number;
  }>(
    `SELECT v.uuid_venta, v.n_ticket, v.total, v.descuento, v.forma_pago, v.f_alta,
            c.razon_social, coalesce(u.nombre, '—') AS vendedor, v.is_active
     FROM venta v
     JOIN cliente c ON c.uuid_cliente = v.uuid_cliente
     LEFT JOIN usuario u ON u.uuid_usuario = v.uuid_vendedor
     WHERE v.uuid_sucursal = $1
     ORDER BY v.f_alta DESC
     LIMIT 80`,
    [user.uuid_sucursal],
  );

  return NextResponse.json({ ventas: rows });
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
    lineas?: LineIn[];
    uuid_cliente?: string;
    idc_forma_pago?: number;
    monto_recibido?: number;
    descuento_ticket?: number;
    comentario?: string;
    uuid_venta_espera?: string;
  } | null;

  if (!body?.lineas?.length) {
    return NextResponse.json({ error: "Agregá al menos un producto" }, { status: 400 });
  }

  const descTicket = Number(body.descuento_ticket ?? 0);
  if (descTicket < 0 || !Number.isFinite(descTicket)) {
    return NextResponse.json({ error: "Descuento inválido" }, { status: 400 });
  }
  const anyLineDisc = body.lineas.some((l) => Number(l.descuento ?? 0) > 0);
  if ((descTicket > 0 || anyLineDisc) && !hasPrivilege(user.role, "descontar")) {
    return NextResponse.json(
      { error: "Sin privilegio para descontar (Supervisor/Admin)" },
      { status: 403 },
    );
  }

  const turno = await sql<{ uuid_cortecaja: string }>(
    `SELECT uuid_cortecaja FROM corte_caja
     WHERE uuid_sucursal = $1 AND is_closed = 0 LIMIT 1`,
    [user.uuid_sucursal],
  );
  if (!turno[0]) {
    return NextResponse.json(
      { error: "Abrí un turno antes de vender" },
      { status: 409 },
    );
  }

  const formaId = body.idc_forma_pago ?? 1;
  const formaRows = await sql<{ descripcion_f_pago: string }>(
    `SELECT descripcion_f_pago FROM c_forma_pago WHERE idc_forma_pago = $1`,
    [formaId],
  );
  if (!formaRows[0]) {
    return NextResponse.json({ error: "Forma de pago inválida" }, { status: 400 });
  }

  const uuidCliente = body.uuid_cliente ?? "cli-publico-001";
  const clienteOk = await sql<{ uuid_cliente: string }>(
    `SELECT uuid_cliente FROM cliente WHERE uuid_cliente = $1 AND is_active = 1`,
    [uuidCliente],
  );
  if (!clienteOk[0]) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });
  }

  type BuiltLine = {
    uuid_producto: string;
    uuid_departamento: string | null;
    cbarras: string;
    nombre_producto: string;
    unidad: string;
    precio_compra: number;
    cantidad: number;
    precio_unitario: number;
    importe: number;
    tasa: number;
    iva_cobrado: number;
    descuento: number;
    total: number;
  };

  const built: BuiltLine[] = [];
  let bruto = 0;

  for (const line of body.lineas) {
    const qty = Number(line.cantidad);
    const lineDisc = Number(line.descuento ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
    }
    if (!Number.isFinite(lineDisc) || lineDisc < 0) {
      return NextResponse.json({ error: "Descuento de línea inválido" }, { status: 400 });
    }
    const prod = await sql<{
      uuid_producto: string;
      uuid_departamento: string | null;
      cbarras: string;
      nombre_producto: string;
      clave_unidad: string;
      precio_compra: number;
      precio_venta: number;
      tasa_cuota_iva: number;
      existencia: number;
      is_inventory: number;
    }>(
      `SELECT p.uuid_producto, p.uuid_departamento, p.cbarras, p.nombre_producto,
              p.clave_unidad, ps.precio_compra, ps.precio_venta, p.tasa_cuota_iva,
              ps.existencia, p.is_inventory
       FROM producto p
       JOIN producto_sucursal ps ON ps.uuid_producto = p.uuid_producto
       WHERE p.uuid_producto = $1 AND ps.uuid_sucursal = $2 AND p.is_active = 1
       LIMIT 1`,
      [line.uuid_producto, user.uuid_sucursal],
    );
    const p = prod[0];
    if (!p) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 400 });
    }
    if (p.is_inventory === 1 && p.existencia < qty) {
      return NextResponse.json(
        { error: `Stock insuficiente: ${p.nombre_producto}` },
        { status: 409 },
      );
    }

    const lineBruto = round2(p.precio_venta * qty);
    if (lineDisc > lineBruto) {
      return NextResponse.json(
        { error: `Descuento mayor al importe de ${p.nombre_producto}` },
        { status: 400 },
      );
    }
    const lineTotal = round2(lineBruto - lineDisc);
    const split = splitTaxIncluded(lineTotal, Number(p.tasa_cuota_iva) || 0);
    built.push({
      uuid_producto: p.uuid_producto,
      uuid_departamento: p.uuid_departamento,
      cbarras: p.cbarras,
      nombre_producto: p.nombre_producto,
      unidad: p.clave_unidad === "H87" ? "Pieza" : p.clave_unidad,
      precio_compra: p.precio_compra,
      cantidad: qty,
      precio_unitario: p.precio_venta,
      importe: split.subtotal,
      tasa: Number(p.tasa_cuota_iva) || 0,
      iva_cobrado: split.iva,
      descuento: lineDisc,
      total: split.total,
    });
    bruto = round2(bruto + lineBruto);
  }

  const lineDiscSum = round2(built.reduce((a, l) => a + l.descuento, 0));
  if (descTicket > round2(bruto - lineDiscSum)) {
    return NextResponse.json(
      { error: "Descuento de ticket mayor al total" },
      { status: 400 },
    );
  }

  // Apply ticket discount proportionally to line totals for tax split
  let subtotal = 0;
  let iva = 0;
  const totalBeforeTicket = round2(built.reduce((a, l) => a + l.total, 0));
  if (descTicket > 0 && totalBeforeTicket > 0) {
    let allocated = 0;
    for (let i = 0; i < built.length; i++) {
      const share =
        i === built.length - 1
          ? round2(descTicket - allocated)
          : round2((built[i].total / totalBeforeTicket) * descTicket);
      allocated = round2(allocated + share);
      const newTotal = round2(Math.max(0, built[i].total - share));
      const split = splitTaxIncluded(newTotal, built[i].tasa);
      built[i].descuento = round2(built[i].descuento + share);
      built[i].importe = split.subtotal;
      built[i].iva_cobrado = split.iva;
      built[i].total = split.total;
    }
  }

  subtotal = round2(built.reduce((a, l) => a + l.importe, 0));
  iva = round2(built.reduce((a, l) => a + l.iva_cobrado, 0));
  const total = round2(built.reduce((a, l) => a + l.total, 0));
  const descuentoTotal = round2(lineDiscSum + descTicket);

  const montoRecibido = Number(body.monto_recibido ?? total);
  if (!Number.isFinite(montoRecibido) || montoRecibido < total) {
    return NextResponse.json(
      { error: "El monto recibido es menor al total" },
      { status: 400 },
    );
  }
  const cambio = round2(montoRecibido - total);

  const countRows = await sql<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM venta WHERE uuid_sucursal = $1`,
    [user.uuid_sucursal],
  );
  const seq = (countRows[0]?.c ?? 0) + 1;
  const nTicket = `T-${String(seq).padStart(6, "0")}`;
  const uuidVenta = randomUUID();

  await sql(
    `INSERT INTO venta (
       uuid_venta, n_ticket, uuid_sucursal, uuid_vendedor, uuid_cliente, uuid_cortecaja,
       subtotal, descuento, iva, ieps, total, monto_recibido, monto_cambio,
       idc_forma_pago, forma_pago, comentario, is_paid, is_active, f_alta
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,$12,$13,$14,$15,1,1,$16)`,
    [
      uuidVenta,
      nTicket,
      user.uuid_sucursal,
      user.uuid_usuario,
      uuidCliente,
      turno[0].uuid_cortecaja,
      subtotal,
      descuentoTotal,
      iva,
      total,
      montoRecibido,
      cambio,
      formaId,
      formaRows[0].descripcion_f_pago,
      body.comentario ?? null,
      new Date().toISOString(),
    ],
  );

  for (const line of built) {
    await sql(
      `INSERT INTO venta_producto (
         uuid_venta_producto, uuid_venta, uuid_producto, uuid_departamento,
         cbarras, nombre_producto, unidad, precio_compra, cantidad, precio_unitario,
         importe, tasa_cuota_iva, iva_cobrado, descuento, total, is_active
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,1)`,
      [
        randomUUID(),
        uuidVenta,
        line.uuid_producto,
        line.uuid_departamento,
        line.cbarras,
        line.nombre_producto,
        line.unidad,
        line.precio_compra,
        line.cantidad,
        line.precio_unitario,
        line.importe,
        String(line.tasa),
        line.iva_cobrado,
        line.descuento,
        line.total,
      ],
    );
    await sql(
      `UPDATE producto_sucursal
       SET existencia = existencia - $1
       WHERE uuid_producto = $2 AND uuid_sucursal = $3`,
      [line.cantidad, line.uuid_producto, user.uuid_sucursal],
    );
  }

  const isCash = formaId === 1;
  await sql(
    `UPDATE corte_caja SET
       efectivo_cobrado = efectivo_cobrado + $1,
       tarjetas_credito = tarjetas_credito + $2,
       tarjetas_debito = tarjetas_debito + $3,
       transferencias = transferencias + $4,
       total_credito = total_credito + $5,
       n_ventas_efectivo = n_ventas_efectivo + $6,
       n_ventas_otros = n_ventas_otros + $7,
       ingresos_totales = ingresos_totales + $8,
       total_neto = total_neto + $8,
       total_efectivo = total_efectivo + $1,
       descuentos = descuentos + $9
     WHERE uuid_cortecaja = $10`,
    [
      isCash ? total : 0,
      formaId === 2 ? total : 0,
      formaId === 3 ? total : 0,
      formaId === 4 ? total : 0,
      formaId === 5 ? total : 0,
      isCash ? 1 : 0,
      isCash ? 0 : 1,
      total,
      descuentoTotal,
      turno[0].uuid_cortecaja,
    ],
  );

  if (body.uuid_venta_espera) {
    await sql(
      `UPDATE venta_espera SET vendido = 1, f_update = $1
       WHERE uuid_venta_espera = $2 AND uuid_sucursal = $3`,
      [new Date().toISOString(), body.uuid_venta_espera, user.uuid_sucursal],
    );
  }

  return NextResponse.json({
    uuid_venta: uuidVenta,
    n_ticket: nTicket,
    total,
    descuento: descuentoTotal,
    monto_cambio: cambio,
  });
}
