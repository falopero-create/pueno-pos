import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { round2 } from "@/lib/money";
import { hasPrivilege } from "@/lib/roles";

type LineIn = {
  uuid_producto: string;
  cantidad: number;
  precio_unitario?: number;
};

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const rows = await sql<{
    uuid_recepcion: string;
    num_factura: string;
    total: number;
    f_alta: string;
    comentarios: string | null;
    usuario: string | null;
  }>(
    `SELECT r.uuid_recepcion, r.num_factura, r.total, r.f_alta, r.comentarios,
            u.nombre AS usuario
     FROM recepcion r
     LEFT JOIN usuario u ON u.uuid_usuario = r.uuid_usuario
     WHERE r.uuid_sucursal = $1
     ORDER BY r.f_alta DESC
     LIMIT 40`,
    [user.uuid_sucursal],
  );
  return NextResponse.json({ recepciones: rows });
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
    lineas?: LineIn[];
    num_factura?: string;
    comentarios?: string;
    uuid_proveedor?: string;
  } | null;

  if (!body?.lineas?.length) {
    return NextResponse.json({ error: "Agregá productos a recibir" }, { status: 400 });
  }

  const uuid = randomUUID();
  let total = 0;
  const built: {
    uuid_producto: string;
    uuid_producto_sucursal: string;
    cantidad: number;
    precio_unitario: number;
    total: number;
  }[] = [];

  for (const line of body.lineas) {
    const qty = Number(line.cantidad);
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
    }
    const prod = await sql<{
      uuid_producto: string;
      uuid_producto_sucursal: string;
      precio_compra: number;
    }>(
      `SELECT p.uuid_producto, ps.uuid_producto_sucursal, ps.precio_compra
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
    const precio = Number(line.precio_unitario ?? p.precio_compra);
    const lineTotal = round2(precio * qty);
    built.push({
      uuid_producto: p.uuid_producto,
      uuid_producto_sucursal: p.uuid_producto_sucursal,
      cantidad: qty,
      precio_unitario: precio,
      total: lineTotal,
    });
    total = round2(total + lineTotal);
  }

  await sql(
    `INSERT INTO recepcion (
       uuid_recepcion, uuid_sucursal, uuid_proveedor, uuid_usuario,
       num_factura, comentarios, total, f_alta
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      uuid,
      user.uuid_sucursal,
      body.uuid_proveedor ?? "prov-demo-001",
      user.uuid_usuario,
      body.num_factura?.trim() || `R-${Date.now().toString().slice(-6)}`,
      body.comentarios ?? null,
      total,
      new Date().toISOString(),
    ],
  );

  for (const line of built) {
    await sql(
      `INSERT INTO recepcion_linea (
         uuid_recepcion_linea, uuid_recepcion, uuid_producto, uuid_producto_sucursal,
         cantidad, precio_unitario, total
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        randomUUID(),
        uuid,
        line.uuid_producto,
        line.uuid_producto_sucursal,
        line.cantidad,
        line.precio_unitario,
        line.total,
      ],
    );
    await sql(
      `UPDATE producto_sucursal
       SET existencia = existencia + $1,
           precio_compra = CASE WHEN $2 > 0 THEN $2 ELSE precio_compra END
       WHERE uuid_producto_sucursal = $3`,
      [line.cantidad, line.precio_unitario, line.uuid_producto_sucursal],
    );
  }

  return NextResponse.json({ uuid_recepcion: uuid, total });
}
