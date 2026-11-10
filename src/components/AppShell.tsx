"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { roleLabel, type Role } from "@/lib/roles";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/caja", label: "Caja", hint: "Cobrar y turnos" },
  { href: "/ventas", label: "Ventas", hint: "Historial de tickets" },
  { href: "/productos", label: "Productos", hint: "Catálogo y stock" },
  { href: "/clientes", label: "Clientes", hint: "Agenda" },
  { href: "/dinero", label: "Dinero", hint: "Cortes y movimientos" },
  { href: "/reportes", label: "Reportes", hint: "Vendidos y márgenes" },
  { href: "/config", label: "Config", hint: "Empresa y usuarios" },
] as const;

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="app-frame">
      <aside className={`side-nav ${open ? "open" : ""}`}>
        <div className="brand-block">
          <p className="brand-mark">Pueno</p>
          <p className="brand-sub">Punto de Venta</p>
        </div>
        <nav className="nav-list" aria-label="Oficios">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active ? "active" : ""}`}
                onClick={() => setOpen(false)}
              >
                <span className="nav-label">{item.label}</span>
                <span className="nav-hint">{item.hint}</span>
              </Link>
            );
          })}
        </nav>
        <div className="side-footer">
          <div className="user-chip">
            <strong>{user.nombre}</strong>
            <span>
              {roleLabel(user.role as Role)} · {user.nombre_sucursal}
            </span>
          </div>
          <button
            type="button"
            className="ghost-btn"
            onClick={onLogout}
            disabled={busy}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <button
            type="button"
            className="menu-btn"
            aria-label="Abrir menú"
            onClick={() => setOpen((v) => !v)}
          >
            Menú
          </button>
          <div className="topbar-meta">
            <span className="empresa">{user.nombre_empresa}</span>
            <span className="sucursal">{user.nombre_sucursal}</span>
          </div>
        </header>
        <main className="page-body">{children}</main>
      </div>

      {open ? (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
