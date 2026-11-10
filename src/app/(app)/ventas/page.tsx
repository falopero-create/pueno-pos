import { VentasHistorial } from "@/components/VentasHistorial";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export default async function VentasPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const ventas = await sql<{
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

  return <VentasHistorial ventas={ventas} />;
}
