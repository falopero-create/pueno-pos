import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const rows = await sql<{
    uuid_cliente: string;
    razon_social: string;
    rfc: string | null;
    telefono: string | null;
    email: string | null;
    lim_credito: number;
  }>(
    `SELECT uuid_cliente, razon_social, rfc, telefono, email, lim_credito
     FROM cliente
     WHERE is_active = 1
     ORDER BY razon_social`,
  );

  return NextResponse.json({ clientes: rows });
}
