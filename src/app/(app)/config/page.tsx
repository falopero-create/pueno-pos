import { getSessionUser } from "@/lib/auth";
import { roleLabel } from "@/lib/roles";

export default async function ConfigPage() {
  const user = await getSessionUser();
  if (!user) return null;

  return (
    <div className="panel stack">
      <div className="panel-head">
        <div>
          <h1>Configuración</h1>
          <p className="muted">Empresa, sucursal y sesión actuales.</p>
        </div>
      </div>
      <div>
        <p>
          <strong>Empresa:</strong> {user.nombre_empresa}
        </p>
        <p>
          <strong>Sucursal:</strong> {user.nombre_sucursal}
        </p>
        <p>
          <strong>Usuario:</strong> {user.nombre} ({user.username})
        </p>
        <p>
          <strong>Rol:</strong> {roleLabel(user.role)}
        </p>
      </div>
      <div className="placeholder-note">
        Roles mapeados: Admin (todo), Supervisor (vender/cortar/inventario/reportes),
        Cajero (vender). Privilegios granulares estilo Pueno se expanden en fases
        posteriores.
      </div>
    </div>
  );
}
