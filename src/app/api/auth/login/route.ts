import { NextResponse } from "next/server";
import { login } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;
  if (!body?.username || !body?.password) {
    return NextResponse.json(
      { error: "Usuario y contraseña requeridos" },
      { status: 400 },
    );
  }
  const user = await login(body.username, body.password);
  if (!user) {
    return NextResponse.json(
      { error: "Credenciales incorrectas" },
      { status: 401 },
    );
  }
  return NextResponse.json({ user });
}
