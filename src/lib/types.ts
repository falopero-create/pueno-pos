import type { Role } from "./roles";

export type SessionUser = {
  uuid_usuario: string;
  username: string;
  nombre: string;
  role: Role;
  uuid_sucursal: string;
  nombre_sucursal: string;
  uuid_empresa: string;
  nombre_empresa: string;
};
