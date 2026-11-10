"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";

type Categoria = { uuid_categoria: string; nombre_categoria: string };
type Producto = {
  uuid_producto: string;
  uuid_categoria: string;
  cbarras: string;
  nombre_producto: string;
  existencia: number;
  precio_venta: number;
  precio_compra: number;
  d_inv_min: number;
  nombre_categoria: string;
  tasa_cuota_iva: number;
};

export function InventarioPanel({ canEdit }: { canEdit: boolean }) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [alertas, setAlertas] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"lista" | "alta" | "recepcion" | "categorias">(
    "lista",
  );

  const [form, setForm] = useState({
    nombre_producto: "",
    cbarras: "",
    uuid_categoria: "",
    precio_venta: "0",
    precio_compra: "0",
    existencia: "0",
    d_inv_min: "5",
    tasa_cuota_iva: "0.16",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [catNombre, setCatNombre] = useState("");
  const [recvQty, setRecvQty] = useState<Record<string, string>>({});
  const [factura, setFactura] = useState("");

  async function load() {
    const [p, c] = await Promise.all([
      fetch(`/api/productos?alertas=${alertas ? "1" : "0"}`).then((r) => r.json()),
      fetch("/api/categorias").then((r) => r.json()),
    ]);
    setProductos(p.productos ?? []);
    setCategorias(c.categorias ?? []);
    if (!form.uuid_categoria && c.categorias?.[0]) {
      setForm((f) => ({ ...f, uuid_categoria: c.categorias[0].uuid_categoria }));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertas]);

  async function saveProduct(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setMsg("");
    try {
      const payload = {
        nombre_producto: form.nombre_producto,
        cbarras: form.cbarras,
        uuid_categoria: form.uuid_categoria,
        precio_venta: Number(form.precio_venta) || 0,
        precio_compra: Number(form.precio_compra) || 0,
        existencia: Number(form.existencia) || 0,
        d_inv_min: Number(form.d_inv_min) || 0,
        tasa_cuota_iva: Number(form.tasa_cuota_iva) || 0,
      };
      const res = await fetch("/api/productos", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editId ? { uuid_producto: editId, ...payload } : payload,
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Error al guardar");
        return;
      }
      setMsg(editId ? "Producto actualizado" : "Producto creado");
      setEditId(null);
      setForm({
        nombre_producto: "",
        cbarras: "",
        uuid_categoria: form.uuid_categoria,
        precio_venta: "0",
        precio_compra: "0",
        existencia: "0",
        d_inv_min: "5",
        tasa_cuota_iva: "0.16",
      });
      setTab("lista");
      await load();
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p: Producto) {
    setEditId(p.uuid_producto);
    setForm({
      nombre_producto: p.nombre_producto,
      cbarras: p.cbarras,
      uuid_categoria: p.uuid_categoria,
      precio_venta: String(p.precio_venta),
      precio_compra: String(p.precio_compra),
      existencia: String(p.existencia),
      d_inv_min: String(p.d_inv_min),
      tasa_cuota_iva: String(p.tasa_cuota_iva),
    });
    setTab("alta");
  }

  async function createCategoria(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre_categoria: catNombre }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Error categoría");
        return;
      }
      setCatNombre("");
      setMsg(`Categoría ${data.nombre_categoria} creada`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function recibir(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    const lineas = Object.entries(recvQty)
      .map(([uuid_producto, cantidad]) => ({
        uuid_producto,
        cantidad: Number(cantidad) || 0,
      }))
      .filter((l) => l.cantidad > 0);
    if (!lineas.length) {
      setMsg("Indicá cantidades a recibir");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/recepcion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineas, num_factura: factura }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Error en recepción");
        return;
      }
      setMsg(`Recepción OK · total ${formatMoney(data.total)}`);
      setRecvQty({});
      setFactura("");
      setTab("lista");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="panel">
        <div className="panel-head">
          <div>
            <h1>Productos e inventario</h1>
            <p className="muted">
              Alta/edición, recepción de stock y alertas bajo mínimo
            </p>
          </div>
        </div>
        <div className="row-actions">
          {(
            [
              ["lista", "Catálogo"],
              ["alta", editId ? "Editar" : "Nuevo"],
              ["recepcion", "Recepción"],
              ["categorias", "Categorías"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "primary-btn" : "secondary-btn"}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className={alertas ? "primary-btn" : "secondary-btn"}
            onClick={() => setAlertas((v) => !v)}
          >
            {alertas ? "Ver todos" : "Solo bajo mínimo"}
          </button>
        </div>
        {msg ? (
          <div className="badge" style={{ marginTop: "0.8rem" }}>
            {msg}
          </div>
        ) : null}
        {!canEdit ? (
          <div className="placeholder-note">
            Tu rol solo puede consultar. Alta/recepción requieren Supervisor/Admin.
          </div>
        ) : null}
      </div>

      {tab === "lista" ? (
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Stock</th>
                <th>Mín</th>
                <th>Precio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.uuid_producto}>
                  <td>{p.cbarras}</td>
                  <td>{p.nombre_producto}</td>
                  <td>{p.nombre_categoria}</td>
                  <td>
                    {p.existencia}
                    {p.existencia <= p.d_inv_min ? (
                      <span className="badge warn" style={{ marginLeft: 8 }}>
                        Bajo
                      </span>
                    ) : null}
                  </td>
                  <td>{p.d_inv_min}</td>
                  <td>{formatMoney(p.precio_venta)}</td>
                  <td>
                    {canEdit ? (
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => startEdit(p)}
                      >
                        Editar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {loading ? (
                <tr>
                  <td colSpan={7} className="muted">
                    Cargando catálogo…
                  </td>
                </tr>
              ) : !productos.length ? (
                <tr>
                  <td colSpan={7} className="muted">
                    {alertas
                      ? "No hay productos bajo mínimo."
                      : "Sin productos."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "alta" && canEdit ? (
        <form className="panel stack" onSubmit={saveProduct}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)" }}>
            {editId ? "Editar producto" : "Nuevo producto"}
          </h2>
          <div className="field">
            <label>Nombre</label>
            <input
              required
              value={form.nombre_producto}
              onChange={(e) =>
                setForm((f) => ({ ...f, nombre_producto: e.target.value }))
              }
            />
          </div>
          <div className="field">
            <label>Código de barras</label>
            <input
              required
              disabled={!!editId}
              value={form.cbarras}
              onChange={(e) =>
                setForm((f) => ({ ...f, cbarras: e.target.value }))
              }
            />
          </div>
          <div className="field">
            <label>Categoría</label>
            <select
              required
              value={form.uuid_categoria}
              onChange={(e) =>
                setForm((f) => ({ ...f, uuid_categoria: e.target.value }))
              }
            >
              {categorias.map((c) => (
                <option key={c.uuid_categoria} value={c.uuid_categoria}>
                  {c.nombre_categoria}
                </option>
              ))}
            </select>
          </div>
          <div className="row-actions">
            <div className="field" style={{ flex: 1 }}>
              <label>Precio venta</label>
              <input
                type="number"
                step="0.01"
                value={form.precio_venta}
                onChange={(e) =>
                  setForm((f) => ({ ...f, precio_venta: e.target.value }))
                }
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Precio compra</label>
              <input
                type="number"
                step="0.01"
                value={form.precio_compra}
                onChange={(e) =>
                  setForm((f) => ({ ...f, precio_compra: e.target.value }))
                }
              />
            </div>
          </div>
          {!editId ? (
            <div className="field">
              <label>Existencia inicial</label>
              <input
                type="number"
                step="1"
                value={form.existencia}
                onChange={(e) =>
                  setForm((f) => ({ ...f, existencia: e.target.value }))
                }
              />
            </div>
          ) : null}
          <div className="row-actions">
            <div className="field" style={{ flex: 1 }}>
              <label>Mínimo</label>
              <input
                type="number"
                value={form.d_inv_min}
                onChange={(e) =>
                  setForm((f) => ({ ...f, d_inv_min: e.target.value }))
                }
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>IVA (0–1)</label>
              <input
                type="number"
                step="0.01"
                value={form.tasa_cuota_iva}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tasa_cuota_iva: e.target.value }))
                }
              />
            </div>
          </div>
          <button className="primary-btn" type="submit" disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </form>
      ) : null}

      {tab === "recepcion" && canEdit ? (
        <form className="panel stack" onSubmit={recibir}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)" }}>
            Recepción de mercancía
          </h2>
          <div className="field">
            <label>Nº factura / remisión</label>
            <input
              value={factura}
              onChange={(e) => setFactura(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Stock</th>
                <th>Entrada</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.uuid_producto}>
                  <td>{p.nombre_producto}</td>
                  <td>{p.existencia}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      style={{ width: 90 }}
                      value={recvQty[p.uuid_producto] ?? ""}
                      onChange={(e) =>
                        setRecvQty((prev) => ({
                          ...prev,
                          [p.uuid_producto]: e.target.value,
                        }))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="primary-btn" type="submit" disabled={busy}>
            Confirmar recepción
          </button>
        </form>
      ) : null}

      {tab === "categorias" ? (
        <div className="panel stack">
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)" }}>
            Categorías
          </h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {categorias.map((c) => (
              <li key={c.uuid_categoria}>{c.nombre_categoria}</li>
            ))}
          </ul>
          {canEdit ? (
            <form className="row-actions" onSubmit={createCategoria}>
              <div className="field" style={{ flex: 1 }}>
                <label>Nueva categoría</label>
                <input
                  required
                  value={catNombre}
                  onChange={(e) => setCatNombre(e.target.value)}
                />
              </div>
              <button className="primary-btn" type="submit" disabled={busy}>
                Agregar
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
