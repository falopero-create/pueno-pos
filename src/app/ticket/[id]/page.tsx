import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;

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
    razon_social: string;
    rfc: string | null;
    vendedor: string;
    nombre_sucursal: string;
    nombre_empresa: string;
  }>(
    `SELECT v.uuid_venta, v.n_ticket, v.subtotal, v.descuento, v.iva, v.total, v.monto_recibido,
            v.monto_cambio, v.forma_pago, v.f_alta,
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
  if (!venta) notFound();

  const lineas = await sql<{
    nombre_producto: string;
    cantidad: number;
    precio_unitario: number;
    total: number;
  }>(
    `SELECT nombre_producto, cantidad, precio_unitario, total
     FROM venta_producto WHERE uuid_venta = $1 AND is_active = 1`,
    [id],
  );

  return (
    <div style={{ padding: "1.5rem" }}>
      <div className="row-actions no-print" style={{ marginBottom: "1rem" }}>
        <Link className="secondary-btn" href="/ventas">
          Volver
        </Link>
        <Link className="secondary-btn" href="/caja">
          Caja
        </Link>
        <PrintButton />
      </div>

      <article className="ticket-sheet">
        <h1>{venta.nombre_empresa}</h1>
        <p className="center">{venta.nombre_sucursal}</p>
        <p className="center">Ticket {venta.n_ticket}</p>
        <p className="center">{new Date(venta.f_alta).toLocaleString("es-MX")}</p>
        <hr />
        <p>Cliente: {venta.razon_social}</p>
        {venta.rfc ? <p>RFC: {venta.rfc}</p> : null}
        <p>Cajero: {venta.vendedor}</p>
        <hr />
        {lineas.map((l, i) => (
          <div key={`${l.nombre_producto}-${i}`}>
            <div>{l.nombre_producto}</div>
            <div className="ticket-line">
              <span>
                {l.cantidad} x {formatMoney(l.precio_unitario)}
              </span>
              <span>{formatMoney(l.total)}</span>
            </div>
          </div>
        ))}
        <hr />
        <div className="ticket-line">
          <span>Subtotal</span>
          <span>{formatMoney(venta.subtotal)}</span>
        </div>
        {Number(venta.descuento) > 0 ? (
          <div className="ticket-line">
            <span>Descuento</span>
            <span>−{formatMoney(venta.descuento)}</span>
          </div>
        ) : null}
        <div className="ticket-line">
          <span>IVA</span>
          <span>{formatMoney(venta.iva)}</span>
        </div>
        <div className="ticket-line">
          <strong>TOTAL</strong>
          <strong>{formatMoney(venta.total)}</strong>
        </div>
        <div className="ticket-line">
          <span>{venta.forma_pago}</span>
          <span>{formatMoney(venta.monto_recibido)}</span>
        </div>
        <div className="ticket-line">
          <span>Cambio</span>
          <span>{formatMoney(venta.monto_cambio)}</span>
        </div>
        <hr />
        <p className="center">¡Gracias por su compra!</p>
        <p className="center muted">Pueno POS · ticket 58 mm</p>
      </article>
    </div>
  );
}
