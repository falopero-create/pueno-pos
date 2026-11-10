"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/setup");
        const data = await res.json();
        if (!cancelled) setNeedsSetup(Boolean(data.needsSetup));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo iniciar sesión");
        return;
      }
      router.replace("/caja");
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card stack" onSubmit={onSubmit}>
        <div>
          <p className="brand-mark">Pueno</p>
          <p className="brand-sub">Punto de Venta · web / PWA</p>
          <h1>Entrar a caja</h1>
          <p className="muted" style={{ marginTop: "0.45rem" }}>
            Misma lógica de turnos y tickets, con un menú más claro.
          </p>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        {needsSetup ? (
          <div className="placeholder-note">
            Todavía no hay usuarios.{" "}
            <Link href="/setup">Creá el administrador inicial</Link>.
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="username">Usuario</label>
          <input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button className="primary-btn" type="submit" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
