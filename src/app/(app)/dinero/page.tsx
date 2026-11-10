import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { hasPrivilege } from "@/lib/roles";

export default async function DineroPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const cortes = await sql<{
    uuid_cortecaja: string;
    clavecaja: string;
    f_abrir: string;
    f_cerrar: string | null;
    monto_inicial: number;
    ingresos_totales: number;
    efectivo_cobrado: number;
    descuentos: number;
    diferencia: number;
    is_closed: number;
    vendedor: string;
  }>(
    `SELECT c.uuid_cortecaja, ca.clavecaja, c.f_abrir, c.f_cerrar, c.monto_inicial,
            c.ingresos_totales, c.efectivo_cobrado, c.descuentos, c.diferencia,
            c.is_closed, u.nombre AS vendedor
     FROM corte_caja c
     JOIN caja ca ON ca.uuid_caja = c.uuid_caja
     JOIN usuario u ON u.uuid_usuario = c.uuid_vendedor
     WHERE c.uuid_sucursal = $1
     ORDER BY c.f_abrir DESC
     LIMIT 30`,
    [user.uuid_sucursal],
  );

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h1>Dinero</h1>
          <p className="muted">
            Cortes de caja con arqueo. Cierre desde Caja
            {hasPrivilege(user.role, "cortar") ? " (tenés privilegio)" : ""}.
          </p>
        </div>
        <Link className="primary-btn" href="/caja">
          Ir a caja
        </Link>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Caja</th>
            <th>Vendedor</th>
            <th>Apertura</th>
            <th>Inicial</th>
            <th>Efectivo</th>
            <th>Desc.</th>
            <th>Ingresos</th>
            <th>Dif.</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {cortes.map((c) => (
            <tr key={c.uuid_cortecaja}>
              <td>{c.clavecaja}</td>
              <td>{c.vendedor}</td>
              <td>{new Date(c.f_abrir).toLocaleString("es-MX")}</td>
              <td>{formatMoney(c.monto_inicial)}</td>
              <td>{formatMoney(c.efectivo_cobrado)}</td>
              <td>{formatMoney(c.descuentos)}</td>
              <td>{formatMoney(c.ingresos_totales)}</td>
              <td>{c.is_closed ? formatMoney(c.diferencia) : "—"}</td>
              <td>
                <span className={`badge ${c.is_closed ? "" : "warn"}`}>
                  {c.is_closed ? "Cerrado" : "Abierto"}
                </span>
              </td>
            </tr>
          ))}
          {!cortes.length ? (
            <tr>
              <td colSpan={9} className="muted">
                Sin cortes todavía.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <div className="placeholder-note">
        Próximo Fase 5: entradas/salidas de efectivo fuera de venta, gastos,
        ingresos y CxP.
      </div>
    </div>
  );
}
