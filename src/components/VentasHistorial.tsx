"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";

type Venta = {
  uuid_venta: string;
  n_ticket: string;
  total: number;
  descuento: number;
  forma_pago: string | null;
  f_alta: string;
  razon_social: string;
  vendedor: string;
  is_active: number;
};

type Linea = {
  uuid_venta_producto: string;
  nombre_producto: string;
  cantidad: number;
  cantidad_devuelta: number;
  total: number;
};

export function VentasHistorial({ ventas }: { ventas: Venta[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [motivo, setMotivo] = useState("Cambio de opinión");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [qtys, setQtys] = useState<Record<string, string>>({});

  const venta = useMemo(
    () => ventas.find((v) => v.uuid_venta === selected) || null,
    [ventas, selected],
  );

  async function openReturn(uuid: string) {
    setSelected(uuid);
    setMsg("");
    const res = await fetch(`/api/ventas/${uuid}`);
    const data = await res.json();
    const ls = (data.lineas || []).map(
      (l: Linea & { cantidad_devuelta?: number }) => ({
        ...l,
        cantidad_devuelta: Number(l.cantidad_devuelta || 0),
      }),
    );
    setLineas(ls);
    const init: Record<string, string> = {};
    for (const l of ls) {
      init[l.uuid_venta_producto] = "0";
    }
    setQtys(init);
  }

  async function devolver(total: boolean) {
    if (!selected) return;
    setBusy(true);
    setMsg("");
    try {
      const body = total
        ? { uuid_venta: selected, motivo, total: true }
        : {
            uuid_venta: selected,
            motivo,
            lineas: Object.entries(qtys)
              .map(([uuid_venta_producto, cantidad]) => ({
                uuid_venta_producto,
                cantidad: Number(cantidad) || 0,
              }))
              .filter((l) => l.cantidad > 0),
          };
      const res = await fetch("/api/devoluciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "No se pudo devolver");
        return;
      }
      setMsg(`Devolución OK · ${formatMoney(data.total)}`);
      setSelected(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="panel">
        <div className="panel-head">
          <div>
            <h1>Historial de ventas</h1>
            <p className="muted">Reimpresión y devoluciones parciales/totales</p>
          </div>
          <Link className="primary-btn" href="/caja">
            Ir a caja
          </Link>
        </div>
        {msg ? <div className="badge" style={{ marginBottom: "0.8rem" }}>{msg}</div> : null}
        <table className="table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Cliente</th>
              <th>Pago</th>
              <th>Desc.</th>
              <th>Total</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.uuid_venta}>
                <td>{v.n_ticket}</td>
                <td>{v.razon_social}</td>
                <td>{v.forma_pago}</td>
                <td>{formatMoney(v.descuento || 0)}</td>
                <td>{formatMoney(v.total)}</td>
                <td>
                  <span className={`badge ${v.is_active ? "" : "warn"}`}>
                    {v.is_active ? "Activa" : "Devuelta"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <Link className="secondary-btn" href={`/ticket/${v.uuid_venta}`}>
                      Reimprimir
                    </Link>
                    {v.is_active ? (
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => openReturn(v.uuid_venta)}
                      >
                        Devolver
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!ventas.length ? (
              <tr>
                <td colSpan={7} className="muted">
                  Sin ventas todavía.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {venta ? (
        <div className="panel stack">
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)" }}>
            Devolver {venta.n_ticket}
          </h2>
          <div className="field">
            <label htmlFor="motivo">Motivo</label>
            <input
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Vendidas</th>
                <th>Ya dev.</th>
                <th>Devolver</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => {
                const restante = Number(l.cantidad) - Number(l.cantidad_devuelta);
                return (
                  <tr key={l.uuid_venta_producto}>
                    <td>{l.nombre_producto}</td>
                    <td>{l.cantidad}</td>
                    <td>{l.cantidad_devuelta}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={restante}
                        step="1"
                        disabled={restante <= 0}
                        value={qtys[l.uuid_venta_producto] ?? "0"}
                        onChange={(e) =>
                          setQtys((prev) => ({
                            ...prev,
                            [l.uuid_venta_producto]: e.target.value,
                          }))
                        }
                        style={{ width: 80 }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="row-actions">
            <button
              type="button"
              className="primary-btn"
              disabled={busy}
              onClick={() => devolver(false)}
            >
              Devolver selección
            </button>
            <button
              type="button"
              className="danger-btn"
              disabled={busy}
              onClick={() => devolver(true)}
            >
              Devolución total
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setSelected(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
