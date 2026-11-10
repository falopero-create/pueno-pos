"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMoney, round2 } from "@/lib/money";

type Producto = {
  uuid_producto: string;
  cbarras: string;
  nombre_producto: string;
  existencia: number;
  precio_venta: number;
  tasa_cuota_iva: number;
  nombre_categoria: string;
};

type CartLine = {
  uuid_producto: string;
  nombre_producto: string;
  precio_venta: number;
  cantidad: number;
  existencia: number;
  descuento: number;
};

type Turno = {
  uuid_cortecaja: string;
  clavecaja: string;
  f_abrir: string;
  monto_inicial: number;
  efectivo_cobrado: number;
  ingresos_totales: number;
  n_ventas_efectivo: number;
  n_ventas_otros: number;
} | null;

type Caja = { uuid_caja: string; clavecaja: string };

type Espera = {
  uuid_venta_espera: string;
  n_ticket: string;
  f_alta: string;
  payload: {
    cart?: CartLine[];
    descuentoTicket?: number;
    forma?: number;
  };
};

export function CajaPos({ canDiscount = false, canClose = false }: { canDiscount?: boolean; canClose?: boolean }) {
  const [turno, setTurno] = useState<Turno>(null);
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [uuidCaja, setUuidCaja] = useState("");
  const [montoInicial, setMontoInicial] = useState("0");
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [forma, setForma] = useState(1);
  const [recibido, setRecibido] = useState("");
  const [descuentoTicket, setDescuentoTicket] = useState("0");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastTicket, setLastTicket] = useState<{
    uuid_venta: string;
    n_ticket: string;
  } | null>(null);
  const [esperas, setEsperas] = useState<Espera[]>([]);
  const [esperaId, setEsperaId] = useState<string | null>(null);
  const [showClose, setShowClose] = useState(false);
  const [efectivoContado, setEfectivoContado] = useState("0");
  const [closeResult, setCloseResult] = useState<{
    diferencia: number;
    efectivo_esperado: number;
    efectivo_contado: number;
  } | null>(null);

  const refreshTurno = useCallback(async () => {
    const res = await fetch("/api/turno");
    const data = await res.json();
    setTurno(data.turno);
    setCajas(data.cajas ?? []);
    if (!uuidCaja && data.cajas?.[0]) setUuidCaja(data.cajas[0].uuid_caja);
    setLoading(false);
  }, [uuidCaja]);

  const refreshEsperas = useCallback(async () => {
    const res = await fetch("/api/espera");
    const data = await res.json();
    setEsperas(data.esperas ?? []);
  }, []);

  useEffect(() => {
    void refreshTurno();
  }, [refreshTurno]);

  useEffect(() => {
    if (!turno) return;
    void refreshEsperas();
  }, [turno, refreshEsperas]);

  useEffect(() => {
    if (!turno) return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/productos?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setProductos(data.productos ?? []);
    }, 180);
    return () => clearTimeout(t);
  }, [q, turno]);

  const bruto = useMemo(
    () => round2(cart.reduce((acc, l) => acc + l.precio_venta * l.cantidad, 0)),
    [cart],
  );
  const descLineas = useMemo(
    () => round2(cart.reduce((acc, l) => acc + (l.descuento || 0), 0)),
    [cart],
  );
  const descTicketNum = Number(descuentoTicket) || 0;
  const total = useMemo(
    () => round2(Math.max(0, bruto - descLineas - descTicketNum)),
    [bruto, descLineas, descTicketNum],
  );

  useEffect(() => {
    setRecibido(String(total));
  }, [total]);

  function addProduct(p: Producto) {
    setCart((prev) => {
      const found = prev.find((l) => l.uuid_producto === p.uuid_producto);
      if (found) {
        if (found.cantidad + 1 > p.existencia) {
          setMsg(`Stock insuficiente de ${p.nombre_producto}`);
          return prev;
        }
        return prev.map((l) =>
          l.uuid_producto === p.uuid_producto
            ? { ...l, cantidad: l.cantidad + 1 }
            : l,
        );
      }
      if (p.existencia < 1) {
        setMsg(`Sin existencia: ${p.nombre_producto}`);
        return prev;
      }
      return [
        ...prev,
        {
          uuid_producto: p.uuid_producto,
          nombre_producto: p.nombre_producto,
          precio_venta: p.precio_venta,
          cantidad: 1,
          existencia: p.existencia,
          descuento: 0,
        },
      ];
    });
    setMsg("");
  }

  function setQty(uuid: string, qty: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.uuid_producto !== uuid) return l;
          const next = Math.max(0, Math.min(qty, l.existencia));
          return { ...l, cantidad: next };
        })
        .filter((l) => l.cantidad > 0),
    );
  }

  function setLineDisc(uuid: string, value: number) {
    if (!canDiscount) {
      setMsg("Sin privilegio para descontar");
      return;
    }
    setCart((prev) =>
      prev.map((l) => {
        if (l.uuid_producto !== uuid) return l;
        const max = round2(l.precio_venta * l.cantidad);
        return { ...l, descuento: Math.max(0, Math.min(value, max)) };
      }),
    );
  }

  async function abrirTurno() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/turno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uuid_caja: uuidCaja,
          monto_inicial: Number(montoInicial) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "No se pudo abrir el turno");
        return;
      }
      setCloseResult(null);
      await refreshTurno();
    } finally {
      setBusy(false);
    }
  }

  async function cobrar() {
    if (!cart.length) {
      setMsg("Agregá productos al ticket");
      return;
    }
    if (descTicketNum > 0 && !canDiscount) {
      setMsg("Sin privilegio para descontar");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineas: cart.map((l) => ({
            uuid_producto: l.uuid_producto,
            cantidad: l.cantidad,
            descuento: l.descuento || 0,
          })),
          idc_forma_pago: forma,
          monto_recibido: Number(recibido) || total,
          descuento_ticket: descTicketNum,
          uuid_venta_espera: esperaId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "No se pudo cobrar");
        return;
      }
      setLastTicket({ uuid_venta: data.uuid_venta, n_ticket: data.n_ticket });
      setCart([]);
      setDescuentoTicket("0");
      setEsperaId(null);
      setMsg(`Venta ${data.n_ticket} registrada · cambio ${formatMoney(data.monto_cambio)}`);
      const prodRes = await fetch(`/api/productos?q=${encodeURIComponent(q)}`);
      setProductos((await prodRes.json()).productos ?? []);
      await refreshTurno();
      await refreshEsperas();
    } finally {
      setBusy(false);
    }
  }

  async function ponerEnEspera() {
    if (!cart.length) {
      setMsg("Nada que dejar en espera");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/espera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { cart, descuentoTicket: descTicketNum, forma },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "No se pudo guardar espera");
        return;
      }
      setCart([]);
      setDescuentoTicket("0");
      setEsperaId(null);
      setMsg(`Ticket en espera ${data.n_ticket}`);
      await refreshEsperas();
    } finally {
      setBusy(false);
    }
  }

  function recuperarEspera(e: Espera) {
    const payload = e.payload || {};
    setCart(payload.cart || []);
    setDescuentoTicket(String(payload.descuentoTicket || 0));
    setForma(payload.forma || 1);
    setEsperaId(e.uuid_venta_espera);
    setMsg(`Recuperaste ${e.n_ticket}`);
  }

  async function cerrarTurno() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/turno/cerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          efectivo_contado: Number(efectivoContado) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "No se pudo cerrar");
        return;
      }
      setCloseResult({
        diferencia: data.diferencia,
        efectivo_esperado: data.efectivo_esperado,
        efectivo_contado: data.efectivo_contado,
      });
      setShowClose(false);
      setCart([]);
      await refreshTurno();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel">Cargando caja…</div>;
  }

  if (!turno) {
    return (
      <div className="stack">
        {closeResult ? (
          <div className="panel">
            <h2 style={{ marginTop: 0, fontFamily: "var(--font-display)" }}>
              Turno cerrado
            </h2>
            <p>
              Esperado {formatMoney(closeResult.efectivo_esperado)} · Contado{" "}
              {formatMoney(closeResult.efectivo_contado)} · Diferencia{" "}
              <strong>{formatMoney(closeResult.diferencia)}</strong>
            </p>
          </div>
        ) : null}
        <div className="panel" style={{ maxWidth: 520 }}>
          <div className="panel-head">
            <div>
              <h1>Abrir turno</h1>
              <p className="muted">
                Antes de cobrar hay que abrir la caja del día.
              </p>
            </div>
          </div>
          <div className="stack">
            {msg ? <div className="error-banner">{msg}</div> : null}
            <div className="field">
              <label htmlFor="caja">Caja</label>
              <select
                id="caja"
                value={uuidCaja}
                onChange={(e) => setUuidCaja(e.target.value)}
              >
                {cajas.map((c) => (
                  <option key={c.uuid_caja} value={c.uuid_caja}>
                    {c.clavecaja}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="monto">Monto inicial</label>
              <input
                id="monto"
                type="number"
                min="0"
                step="0.01"
                value={montoInicial}
                onChange={(e) => setMontoInicial(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="primary-btn"
              onClick={abrirTurno}
              disabled={busy}
            >
              {busy ? "Abriendo…" : "Abrir turno"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Punto de venta</h1>
          <p className="muted">
            Turno abierto · {turno.clavecaja} · cobrado{" "}
            {formatMoney(turno.ingresos_totales || 0)}
          </p>
        </div>
        <div className="row-actions">
          <span className="badge">Turno activo</span>
          {canClose ? (
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                setEfectivoContado(
                  String(
                    round2(
                      Number(turno.monto_inicial) + Number(turno.efectivo_cobrado),
                    ),
                  ),
                );
                setShowClose(true);
              }}
            >
              Cerrar caja
            </button>
          ) : null}
        </div>
      </div>

      {showClose ? (
        <div className="panel" style={{ maxWidth: 480 }}>
          <h2 style={{ marginTop: 0, fontFamily: "var(--font-display)" }}>
            Arqueo y cierre
          </h2>
          <p className="muted">
            Efectivo sistema: inicial {formatMoney(turno.monto_inicial)} + cobrado{" "}
            {formatMoney(turno.efectivo_cobrado)}
          </p>
          {msg ? <div className="error-banner">{msg}</div> : null}
          <div className="field">
            <label htmlFor="contado">Efectivo contado en caja</label>
            <input
              id="contado"
              type="number"
              min="0"
              step="0.01"
              value={efectivoContado}
              onChange={(e) => setEfectivoContado(e.target.value)}
            />
          </div>
          <div className="row-actions" style={{ marginTop: "0.8rem" }}>
            <button
              type="button"
              className="primary-btn"
              onClick={cerrarTurno}
              disabled={busy}
            >
              Confirmar cierre
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setShowClose(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {esperas.length ? (
        <div className="panel">
          <strong>En espera</strong>
          <div className="row-actions" style={{ marginTop: "0.55rem" }}>
            {esperas.map((e) => (
              <button
                key={e.uuid_venta_espera}
                type="button"
                className="secondary-btn"
                onClick={() => recuperarEspera(e)}
              >
                {e.n_ticket}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="pos-grid">
        <section className="panel stack">
          <div className="search-bar">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="buscar">Buscar producto o código</label>
              <input
                id="buscar"
                placeholder="Ej. agua, 7501…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="product-grid">
            {productos.map((p) => (
              <button
                key={p.uuid_producto}
                type="button"
                className="product-tile"
                onClick={() => addProduct(p)}
              >
                <strong>{p.nombre_producto}</strong>
                <span>{p.nombre_categoria}</span>
                <span>
                  {formatMoney(p.precio_venta)} · stock {p.existencia}
                </span>
              </button>
            ))}
            {!productos.length ? (
              <p className="muted">Sin resultados. Probá otro término.</p>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <h2 style={{ margin: "0 0 0.4rem", fontFamily: "var(--font-display)" }}>
            Ticket actual
          </h2>
          {msg ? (
            <div
              className={
                msg.startsWith("Venta") || msg.startsWith("Ticket") || msg.startsWith("Recuperaste")
                  ? "badge"
                  : "error-banner"
              }
              style={{ marginBottom: "0.7rem", display: "block" }}
            >
              {msg}
              {lastTicket ? (
                <>
                  {" "}
                  <Link href={`/ticket/${lastTicket.uuid_venta}`}>
                    Ver / reimprimir
                  </Link>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="cart-lines">
            {cart.map((l) => (
              <div className="cart-line" key={l.uuid_producto}>
                <div>
                  <strong>{l.nombre_producto}</strong>
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    {formatMoney(l.precio_venta)} c/u
                  </div>
                  <div className="qty-controls" style={{ marginTop: "0.35rem" }}>
                    <button
                      type="button"
                      onClick={() => setQty(l.uuid_producto, l.cantidad - 1)}
                    >
                      −
                    </button>
                    <span>{l.cantidad}</span>
                    <button
                      type="button"
                      onClick={() => setQty(l.uuid_producto, l.cantidad + 1)}
                    >
                      +
                    </button>
                  </div>
                  {canDiscount ? (
                    <div className="field" style={{ marginTop: "0.4rem" }}>
                      <label>Desc. línea</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.descuento || 0}
                        onChange={(e) =>
                          setLineDisc(l.uuid_producto, Number(e.target.value) || 0)
                        }
                      />
                    </div>
                  ) : null}
                </div>
                <strong>
                  {formatMoney(l.precio_venta * l.cantidad - (l.descuento || 0))}
                </strong>
              </div>
            ))}
            {!cart.length ? (
              <p className="muted">Tocá un producto para agregarlo.</p>
            ) : null}
          </div>

          <div className="totals">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Bruto</span>
              <span>{formatMoney(bruto)}</span>
            </div>
            {(descLineas > 0 || descTicketNum > 0) && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Descuentos</span>
                <span>−{formatMoney(descLineas + descTicketNum)}</span>
              </div>
            )}
            <div className="grand">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
          </div>

          <div className="stack">
            {canDiscount ? (
              <div className="field">
                <label htmlFor="descTicket">Descuento ticket</label>
                <input
                  id="descTicket"
                  type="number"
                  min="0"
                  step="0.01"
                  value={descuentoTicket}
                  onChange={(e) => setDescuentoTicket(e.target.value)}
                />
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="forma">Forma de pago</label>
              <select
                id="forma"
                value={forma}
                onChange={(e) => setForma(Number(e.target.value))}
              >
                <option value={1}>Efectivo</option>
                <option value={3}>Tarjeta de débito</option>
                <option value={2}>Tarjeta de crédito</option>
                <option value={4}>Transferencia</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="recibido">Monto recibido</label>
              <input
                id="recibido"
                type="number"
                min={total}
                step="0.01"
                value={recibido}
                onChange={(e) => setRecibido(e.target.value)}
              />
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="primary-btn"
                onClick={cobrar}
                disabled={busy || !cart.length}
              >
                {busy ? "Cobrando…" : "Cobrar"}
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={ponerEnEspera}
                disabled={busy || !cart.length}
              >
                En espera
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setCart([]);
                  setEsperaId(null);
                  setDescuentoTicket("0");
                }}
                disabled={!cart.length}
              >
                Vaciar
              </button>
              <Link className="secondary-btn" href="/ventas">
                Historial
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
