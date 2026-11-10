"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SetupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/setup");
        const data = await res.json();
        if (!cancelled && !data.needsSetup) {
          setBlocked(true);
        }
      } catch {
        if (!cancelled) setError("No se pudo verificar el estado de setup");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, nombre }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo crear el administrador");
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

  if (loading) {
    return (
      <div className="login-screen">
        <div className="login-card stack">
          <p className="muted">Comprobando…</p>
        </div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="login-screen">
        <div className="login-card stack">
          <p className="brand-mark">Pueno</p>
          <h1>Setup ya completado</h1>
          <p className="muted">Usá tu usuario para entrar a caja.</p>
          <Link className="primary-btn" href="/login" style={{ textAlign: "center" }}>
            Ir a entrar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <form className="login-card stack" onSubmit={onSubmit}>
        <div>
          <p className="brand-mark">Pueno</p>
          <p className="brand-sub">Configuración inicial</p>
          <h1>Crear administrador</h1>
          <p className="muted" style={{ marginTop: "0.45rem" }}>
            Solo la primera vez. Elegí una contraseña propia (mín. 5 caracteres).
          </p>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="field">
          <label htmlFor="nombre">Nombre</label>
          <input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Administrador"
          />
        </div>
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={5}
          />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirmar contraseña</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={5}
          />
        </div>

        <button className="primary-btn" type="submit" disabled={busy}>
          {busy ? "Creando…" : "Crear y entrar"}
        </button>
      </form>
    </div>
  );
}
