import { InventarioPanel } from "@/components/InventarioPanel";
import { getSessionUser } from "@/lib/auth";
import { hasPrivilege } from "@/lib/roles";

export default async function ProductosPage() {
  const user = await getSessionUser();
  if (!user) return null;
  return <InventarioPanel canEdit={hasPrivilege(user.role, "inventario")} />;
}
