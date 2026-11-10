"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Demo: <strong>admin / admin</strong> · también supervisor / cajero
          (misma clave)
        </p>
      </form>
    </div>
  );
}
