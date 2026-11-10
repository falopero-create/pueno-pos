import { NextResponse } from "next/server";
import { createInitialAdmin, needsInitialSetup } from "@/lib/bootstrap";
import { login } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ needsSetup: await needsInitialSetup() });
}

export async function POST(req: Request) {
  if (!(await needsInitialSetup())) {
    return NextResponse.json(
      { error: "El setup inicial ya se completó" },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    username?: string;
    password?: string;
    nombre?: string;
    email?: string;
  } | null;

  if (!body?.username || !body?.password) {
    return NextResponse.json(
      { error: "Usuario y contraseña requeridos" },
      { status: 400 },
    );
  }

  const result = await createInitialAdmin({
    username: body.username,
    password: body.password,
    nombre: body.nombre,
    email: body.email,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const user = await login(body.username.trim(), body.password);
  return NextResponse.json({ ok: true, user });
}
