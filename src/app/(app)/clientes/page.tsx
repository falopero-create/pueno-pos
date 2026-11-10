import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export default async function ClientesPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const clientes = await sql<{
    razon_social: string;
    rfc: string | null;
    telefono: string | null;
    email: string | null;
    lim_credito: number;
  }>(
    `SELECT razon_social, rfc, telefono, email, lim_credito
     FROM cliente WHERE is_active = 1 ORDER BY razon_social`,
  );

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h1>Clientes</h1>
          <p className="muted">Agenda básica. Crédito y abonos llegan en Fase 4.</p>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Razón social</th>
            <th>RFC</th>
            <th>Teléfono</th>
            <th>Email</th>
            <th>Límite crédito</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.razon_social + (c.rfc ?? "")}>
              <td>{c.razon_social}</td>
              <td>{c.rfc ?? "—"}</td>
              <td>{c.telefono ?? "—"}</td>
              <td>{c.email ?? "—"}</td>
              <td>{c.lim_credito}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
