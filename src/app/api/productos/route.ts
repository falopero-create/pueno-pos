import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { hasPrivilege } from "@/lib/roles";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const alertas = searchParams.get("alertas") === "1";

  const rows = await sql<{
    uuid_producto: string;
    uuid_producto_sucursal: string;
    uuid_categoria: string;
    cbarras: string;
    nombre_producto: string;
    descripcion_producto: string | null;
    existencia: number;
    precio_venta: number;
    precio_compra: number;
    tasa_cuota_iva: number;
    clave_unidad: string;
    nombre_categoria: string;
    d_inv_min: number;
    d_inv_max: number;
  }>(
    `SELECT p.uuid_producto, ps.uuid_producto_sucursal, p.uuid_categoria, p.cbarras,
            p.nombre_producto, p.descripcion_producto, ps.existencia, ps.precio_venta,
            ps.precio_compra, p.tasa_cuota_iva, p.clave_unidad, c.nombre_categoria,
            ps.d_inv_min, ps.d_inv_max
     FROM producto p
     JOIN producto_sucursal ps ON ps.uuid_producto = p.uuid_producto
     JOIN categoria c ON c.uuid_categoria = p.uuid_categoria
     WHERE ps.uuid_sucursal = $1 AND p.is_active = 1 AND ps.is_active = 1
       AND (
         $2 = '' OR
         lower(p.nombre_producto) LIKE lower('%' || $2 || '%') OR
         p.cbarras LIKE '%' || $2 || '%'
       )
       AND ($3 = 0 OR ps.existencia <= ps.d_inv_min)
     ORDER BY p.nombre_producto
     LIMIT 100`,
    [user.uuid_sucursal, q, alertas ? 1 : 0],
  );

  return NextResponse.json({ productos: rows });
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
    nombre_producto?: string;
    cbarras?: string;
    uuid_categoria?: string;
    precio_venta?: number;
    precio_compra?: number;
    existencia?: number;
    d_inv_min?: number;
    d_inv_max?: number;
    tasa_cuota_iva?: number;
    descripcion_producto?: string;
  } | null;

  const nombre = body?.nombre_producto?.trim();
  const cbarras = body?.cbarras?.trim();
  if (!nombre || !cbarras || !body?.uuid_categoria) {
    return NextResponse.json(
      { error: "Nombre, código de barras y categoría son requeridos" },
      { status: 400 },
    );
  }

  const dup = await sql<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM producto WHERE cbarras = $1 AND is_active = 1`,
    [cbarras],
  );
  if ((dup[0]?.c ?? 0) > 0) {
    return NextResponse.json({ error: "Ya existe ese código de barras" }, { status: 409 });
  }

  const dep = await sql<{ uuid_departamento: string; uuid_proveedor: string }>(
    `SELECT c.uuid_departamento, coalesce(
       (SELECT uuid_proveedor FROM proveedor WHERE is_active = 1 LIMIT 1), ''
     ) AS uuid_proveedor
     FROM categoria c WHERE c.uuid_categoria = $1 LIMIT 1`,
    [body.uuid_categoria],
  );
  if (!dep[0]?.uuid_departamento || !dep[0].uuid_proveedor) {
    return NextResponse.json({ error: "Categoría o proveedor inválidos" }, { status: 400 });
  }

  const uuidProd = randomUUID();
  const uuidPs = randomUUID();
  await sql(
    `INSERT INTO producto (
       uuid_producto, uuid_categoria, uuid_departamento, uuid_proveedor,
       cbarras, codigo_sat, nombre_producto, descripcion_producto, clave_unidad,
       inventario_min, tasa_cuota_iva, is_inventory, is_active
     ) VALUES ($1,$2,$3,$4,$5,'01010101',$6,$7,'H87',$8,$9,1,1)`,
    [
      uuidProd,
      body.uuid_categoria,
      dep[0].uuid_departamento,
      dep[0].uuid_proveedor,
      cbarras,
      nombre,
      body.descripcion_producto ?? null,
      Number(body.d_inv_min ?? 0),
      Number(body.tasa_cuota_iva ?? 0.16),
    ],
  );
  await sql(
    `INSERT INTO producto_sucursal (
       uuid_producto_sucursal, uuid_producto, uuid_sucursal, existencia,
       precio_compra, precio_venta, d_inv_min, d_inv_max, is_active
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1)`,
    [
      uuidPs,
      uuidProd,
      user.uuid_sucursal,
      Number(body.existencia ?? 0),
      Number(body.precio_compra ?? 0),
      Number(body.precio_venta ?? 0),
      Number(body.d_inv_min ?? 0),
      Number(body.d_inv_max ?? 0),
    ],
  );

  return NextResponse.json({ uuid_producto: uuidProd, uuid_producto_sucursal: uuidPs });
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
    uuid_producto?: string;
    nombre_producto?: string;
    uuid_categoria?: string;
    precio_venta?: number;
    precio_compra?: number;
    d_inv_min?: number;
    d_inv_max?: number;
    tasa_cuota_iva?: number;
    descripcion_producto?: string;
    is_active?: number;
  } | null;

  if (!body?.uuid_producto) {
    return NextResponse.json({ error: "uuid_producto requerido" }, { status: 400 });
  }

  if (body.nombre_producto?.trim()) {
    await sql(`UPDATE producto SET nombre_producto = $1 WHERE uuid_producto = $2`, [
      body.nombre_producto.trim(),
      body.uuid_producto,
    ]);
  }
  if (body.uuid_categoria) {
    await sql(`UPDATE producto SET uuid_categoria = $1 WHERE uuid_producto = $2`, [
      body.uuid_categoria,
      body.uuid_producto,
    ]);
  }
  if (typeof body.tasa_cuota_iva === "number") {
    await sql(`UPDATE producto SET tasa_cuota_iva = $1 WHERE uuid_producto = $2`, [
      body.tasa_cuota_iva,
      body.uuid_producto,
    ]);
  }
  if (body.descripcion_producto !== undefined) {
    await sql(
      `UPDATE producto SET descripcion_producto = $1 WHERE uuid_producto = $2`,
      [body.descripcion_producto, body.uuid_producto],
    );
  }
  if (typeof body.is_active === "number") {
    await sql(`UPDATE producto SET is_active = $1 WHERE uuid_producto = $2`, [
      body.is_active,
      body.uuid_producto,
    ]);
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (typeof body.precio_venta === "number") {
    sets.push(`precio_venta = $${i++}`);
    params.push(body.precio_venta);
  }
  if (typeof body.precio_compra === "number") {
    sets.push(`precio_compra = $${i++}`);
    params.push(body.precio_compra);
  }
  if (typeof body.d_inv_min === "number") {
    sets.push(`d_inv_min = $${i++}`);
    params.push(body.d_inv_min);
  }
  if (typeof body.d_inv_max === "number") {
    sets.push(`d_inv_max = $${i++}`);
    params.push(body.d_inv_max);
  }
  if (sets.length) {
    params.push(body.uuid_producto, user.uuid_sucursal);
    await sql(
      `UPDATE producto_sucursal SET ${sets.join(", ")}
       WHERE uuid_producto = $${i++} AND uuid_sucursal = $${i}`,
      params,
    );
  }

  return NextResponse.json({ ok: true });
}
