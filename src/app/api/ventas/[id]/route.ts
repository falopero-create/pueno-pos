import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const ventas = await sql<{
    uuid_venta: string;
    n_ticket: string;
    subtotal: number;
    descuento: number;
    iva: number;
    total: number;
    monto_recibido: number;
    monto_cambio: number;
    forma_pago: string | null;
    f_alta: string;
    comentario: string | null;
    razon_social: string;
    rfc: string | null;
    vendedor: string;
    nombre_sucursal: string;
    nombre_empresa: string;
    is_active: number;
  }>(
    `SELECT v.uuid_venta, v.n_ticket, v.subtotal, v.descuento, v.iva, v.total, v.monto_recibido,
            v.monto_cambio, v.forma_pago, v.f_alta, v.comentario, v.is_active,
            c.razon_social, c.rfc, coalesce(u.nombre,'—') AS vendedor,
            s.nombre_sucursal, e.nombre_empresa
     FROM venta v
     JOIN cliente c ON c.uuid_cliente = v.uuid_cliente
     JOIN sucursal s ON s.uuid_sucursal = v.uuid_sucursal
     JOIN empresa e ON e.uuid_empresa = s.uuid_empresa
     LEFT JOIN usuario u ON u.uuid_usuario = v.uuid_vendedor
     WHERE v.uuid_venta = $1 AND v.uuid_sucursal = $2
     LIMIT 1`,
    [id, user.uuid_sucursal],
  );
  const venta = ventas[0];
  if (!venta) {
    return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  }

  const lineas = await sql<{
    uuid_venta_producto: string;
    nombre_producto: string;
    cantidad: number;
    cantidad_devuelta: number;
    precio_unitario: number;
    descuento: number;
    total: number;
    cbarras: string;
  }>(
    `SELECT uuid_venta_producto, nombre_producto, cantidad, cantidad_devuelta,
            precio_unitario, descuento, total, cbarras
     FROM venta_producto WHERE uuid_venta = $1 AND is_active = 1`,
    [id],
  );

  return NextResponse.json({ venta, lineas });
}
