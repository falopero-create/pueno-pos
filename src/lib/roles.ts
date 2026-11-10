export type Role = "admin" | "supervisor" | "cajero";

export type Privilege =
  | "vender"
  | "descontar"
  | "cortar"
  | "inventario"
  | "usuarios"
  | "reportes"
  | "config"
  | "clientes"
  | "dinero";

const ROLE_PRIVILEGES: Record<Role, Privilege[]> = {
  admin: [
    "vender",
    "descontar",
    "cortar",
    "inventario",
    "usuarios",
    "reportes",
    "config",
    "clientes",
    "dinero",
  ],
  supervisor: [
    "vender",
    "descontar",
    "cortar",
    "inventario",
    "reportes",
    "clientes",
    "dinero",
  ],
  cajero: ["vender", "clientes"],
};

export function privilegesForRole(role: Role): Privilege[] {
  return ROLE_PRIVILEGES[role] ?? [];
}

export function hasPrivilege(role: Role, privilege: Privilege): boolean {
  return privilegesForRole(role).includes(privilege);
}

export function roleLabel(role: Role): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "supervisor":
      return "Supervisor";
    case "cajero":
      return "Cajero";
  }
}
