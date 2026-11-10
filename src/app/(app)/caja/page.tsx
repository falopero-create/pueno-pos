import { CajaPos } from "@/components/CajaPos";
import { getSessionUser } from "@/lib/auth";
import { hasPrivilege } from "@/lib/roles";

export default async function CajaPage() {
  const user = await getSessionUser();
  if (!user) return null;
  return (
    <CajaPos
      canDiscount={hasPrivilege(user.role, "descontar")}
      canClose={hasPrivilege(user.role, "cortar")}
    />
  );
}
