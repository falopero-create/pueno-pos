-- Caja completa + inventario: devoluciones, espera, recepción

CREATE TABLE IF NOT EXISTS devolucion (
  id SERIAL PRIMARY KEY,
  uuid_devolucion TEXT NOT NULL UNIQUE,
  uuid_venta TEXT NOT NULL REFERENCES venta(uuid_venta),
  uuid_cortecaja TEXT NOT NULL REFERENCES corte_caja(uuid_cortecaja),
  uuid_vendedor TEXT REFERENCES usuario(uuid_usuario),
  uuid_sucursal TEXT NOT NULL REFERENCES sucursal(uuid_sucursal),
  motivo TEXT,
  total DOUBLE PRECISION NOT NULL DEFAULT 0,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devolucion_producto (
  id SERIAL PRIMARY KEY,
  uuid_devolucion_producto TEXT NOT NULL UNIQUE,
  uuid_devolucion TEXT NOT NULL REFERENCES devolucion(uuid_devolucion),
  uuid_venta_producto TEXT NOT NULL REFERENCES venta_producto(uuid_venta_producto),
  uuid_producto TEXT NOT NULL REFERENCES producto(uuid_producto),
  cantidad DOUBLE PRECISION NOT NULL,
  total DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS venta_espera (
  id SERIAL PRIMARY KEY,
  uuid_venta_espera TEXT NOT NULL UNIQUE,
  n_ticket TEXT NOT NULL,
  uuid_cortecaja TEXT NOT NULL REFERENCES corte_caja(uuid_cortecaja),
  uuid_vendedor TEXT NOT NULL REFERENCES usuario(uuid_usuario),
  uuid_sucursal TEXT NOT NULL REFERENCES sucursal(uuid_sucursal),
  json_payload TEXT NOT NULL,
  vendido INT NOT NULL DEFAULT 0,
  f_alta TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  f_update TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS recepcion (
  id SERIAL PRIMARY KEY,
  uuid_recepcion TEXT NOT NULL UNIQUE,
  uuid_sucursal TEXT NOT NULL REFERENCES sucursal(uuid_sucursal),
  uuid_proveedor TEXT REFERENCES proveedor(uuid_proveedor),
  uuid_usuario TEXT REFERENCES usuario(uuid_usuario),
  num_factura TEXT NOT NULL DEFAULT '',
  comentarios TEXT,
  total DOUBLE PRECISION NOT NULL DEFAULT 0,
  f_alta TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recepcion_linea (
  id SERIAL PRIMARY KEY,
  uuid_recepcion_linea TEXT NOT NULL UNIQUE,
  uuid_recepcion TEXT NOT NULL REFERENCES recepcion(uuid_recepcion),
  uuid_producto TEXT NOT NULL REFERENCES producto(uuid_producto),
  uuid_producto_sucursal TEXT NOT NULL REFERENCES producto_sucursal(uuid_producto_sucursal),
  cantidad DOUBLE PRECISION NOT NULL,
  precio_unitario DOUBLE PRECISION NOT NULL DEFAULT 0,
  total DOUBLE PRECISION NOT NULL DEFAULT 0
);

ALTER TABLE venta_producto ADD COLUMN cantidad_devuelta DOUBLE PRECISION NOT NULL DEFAULT 0;
