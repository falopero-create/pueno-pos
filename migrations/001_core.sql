-- Núcleo alineado a Akasia (empresa, sucursal, usuario, caja, corte, producto, cliente, venta)

CREATE TABLE IF NOT EXISTS empresa (
  id SERIAL PRIMARY KEY,
  uuid_empresa TEXT NOT NULL UNIQUE,
  nombre_empresa TEXT NOT NULL,
  pais TEXT NOT NULL DEFAULT 'México',
  cp TEXT NOT NULL DEFAULT '00000',
  email_empresa TEXT,
  giro_comercial TEXT,
  f_alta TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sucursal (
  id SERIAL PRIMARY KEY,
  uuid_sucursal TEXT NOT NULL UNIQUE,
  uuid_empresa TEXT NOT NULL REFERENCES empresa(uuid_empresa),
  nombre_sucursal TEXT NOT NULL,
  calle TEXT,
  colonia TEXT,
  ciudad TEXT,
  estado TEXT,
  pais TEXT DEFAULT 'México',
  cp TEXT NOT NULL DEFAULT '00000',
  telefono TEXT,
  email TEXT,
  is_active INT NOT NULL DEFAULT 1,
  f_alta TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS c_tipo_usuario (
  idc_tipo_usuario SERIAL PRIMARY KEY,
  descripcion TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usuario (
  id SERIAL PRIMARY KEY,
  uuid_usuario TEXT NOT NULL UNIQUE,
  uuid_sucursal TEXT NOT NULL REFERENCES sucursal(uuid_sucursal),
  idtipo_usuario INT NOT NULL REFERENCES c_tipo_usuario(idc_tipo_usuario),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'supervisor', 'cajero')),
  privilegios TEXT NOT NULL DEFAULT '',
  is_active INT NOT NULL DEFAULT 1,
  f_alta TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caja (
  id SERIAL PRIMARY KEY,
  uuid_caja TEXT NOT NULL UNIQUE,
  uuid_sucursal TEXT NOT NULL REFERENCES sucursal(uuid_sucursal),
  clavecaja TEXT NOT NULL,
  is_active INT NOT NULL DEFAULT 1,
  f_alta TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS corte_caja (
  id SERIAL PRIMARY KEY,
  uuid_cortecaja TEXT NOT NULL UNIQUE,
  uuid_caja TEXT NOT NULL REFERENCES caja(uuid_caja),
  uuid_vendedor TEXT NOT NULL REFERENCES usuario(uuid_usuario),
  uuid_supervisor TEXT NOT NULL REFERENCES usuario(uuid_usuario),
  uuid_sucursal TEXT NOT NULL REFERENCES sucursal(uuid_sucursal),
  uuid_empresa TEXT NOT NULL REFERENCES empresa(uuid_empresa),
  f_abrir TIMESTAMPTZ,
  f_cerrar TIMESTAMPTZ,
  monto_inicial DOUBLE PRECISION NOT NULL DEFAULT 0,
  efectivo_cobrado DOUBLE PRECISION NOT NULL DEFAULT 0,
  tarjetas_debito DOUBLE PRECISION NOT NULL DEFAULT 0,
  tarjetas_credito DOUBLE PRECISION NOT NULL DEFAULT 0,
  transferencias DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_credito DOUBLE PRECISION NOT NULL DEFAULT 0,
  n_ventas_efectivo INT NOT NULL DEFAULT 0,
  n_ventas_otros INT NOT NULL DEFAULT 0,
  descuentos DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_efectivo DOUBLE PRECISION NOT NULL DEFAULT 0,
  ingresos_totales DOUBLE PRECISION NOT NULL DEFAULT 0,
  egresos_totales DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_neto DOUBLE PRECISION NOT NULL DEFAULT 0,
  diferencia DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_closed INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS departamento (
  id SERIAL PRIMARY KEY,
  uuid_departamento TEXT NOT NULL UNIQUE,
  uuid_empresa TEXT NOT NULL REFERENCES empresa(uuid_empresa),
  nombre_dep TEXT NOT NULL,
  is_active INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS categoria (
  id SERIAL PRIMARY KEY,
  uuid_categoria TEXT NOT NULL UNIQUE,
  uuid_departamento TEXT NOT NULL REFERENCES departamento(uuid_departamento),
  nombre_categoria TEXT NOT NULL,
  is_active INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS proveedor (
  id SERIAL PRIMARY KEY,
  uuid_proveedor TEXT NOT NULL UNIQUE,
  razon_social TEXT NOT NULL,
  rfc TEXT,
  is_active INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS producto (
  id SERIAL PRIMARY KEY,
  uuid_producto TEXT NOT NULL UNIQUE,
  uuid_categoria TEXT NOT NULL REFERENCES categoria(uuid_categoria),
  uuid_departamento TEXT REFERENCES departamento(uuid_departamento),
  uuid_proveedor TEXT NOT NULL REFERENCES proveedor(uuid_proveedor),
  cbarras TEXT NOT NULL,
  codigo_sat TEXT NOT NULL DEFAULT '01010101',
  nombre_producto TEXT NOT NULL,
  descripcion_producto TEXT,
  clave_unidad TEXT NOT NULL DEFAULT 'H87',
  inventario_min DOUBLE PRECISION NOT NULL DEFAULT 0,
  tasa_cuota_iva DOUBLE PRECISION NOT NULL DEFAULT 0.16,
  impuesto_incluido INT NOT NULL DEFAULT 1,
  is_inventory INT NOT NULL DEFAULT 1,
  is_active INT NOT NULL DEFAULT 1,
  f_alta TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS producto_sucursal (
  id SERIAL PRIMARY KEY,
  uuid_producto_sucursal TEXT NOT NULL UNIQUE,
  uuid_producto TEXT NOT NULL REFERENCES producto(uuid_producto),
  uuid_sucursal TEXT NOT NULL REFERENCES sucursal(uuid_sucursal),
  existencia DOUBLE PRECISION NOT NULL DEFAULT 0,
  precio_compra DOUBLE PRECISION NOT NULL DEFAULT 0,
  precio_venta DOUBLE PRECISION NOT NULL DEFAULT 0,
  d_inv_min DOUBLE PRECISION NOT NULL DEFAULT 0,
  d_inv_max DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_active INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS cliente (
  id SERIAL PRIMARY KEY,
  uuid_cliente TEXT NOT NULL UNIQUE,
  uuid_sucursal TEXT,
  razon_social TEXT NOT NULL,
  rfc TEXT,
  email TEXT,
  telefono TEXT,
  estado TEXT NOT NULL DEFAULT 'CDMX',
  pais TEXT NOT NULL DEFAULT 'México',
  lim_credito DOUBLE PRECISION NOT NULL DEFAULT 0,
  p_descuento DOUBLE PRECISION NOT NULL DEFAULT 0,
  monedero DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_active INT NOT NULL DEFAULT 1,
  f_alta TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS c_forma_pago (
  idc_forma_pago INT PRIMARY KEY,
  clave TEXT NOT NULL UNIQUE,
  descripcion_f_pago TEXT NOT NULL,
  is_active INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS venta (
  id SERIAL PRIMARY KEY,
  uuid_venta TEXT NOT NULL UNIQUE,
  n_ticket TEXT NOT NULL UNIQUE,
  uuid_sucursal TEXT NOT NULL REFERENCES sucursal(uuid_sucursal),
  uuid_vendedor TEXT REFERENCES usuario(uuid_usuario),
  uuid_cliente TEXT NOT NULL REFERENCES cliente(uuid_cliente),
  uuid_cortecaja TEXT NOT NULL REFERENCES corte_caja(uuid_cortecaja),
  subtotal DOUBLE PRECISION NOT NULL,
  descuento DOUBLE PRECISION NOT NULL DEFAULT 0,
  iva DOUBLE PRECISION NOT NULL DEFAULT 0,
  ieps DOUBLE PRECISION NOT NULL DEFAULT 0,
  total DOUBLE PRECISION NOT NULL,
  monto_recibido DOUBLE PRECISION NOT NULL,
  monto_cambio DOUBLE PRECISION NOT NULL DEFAULT 0,
  moneda TEXT NOT NULL DEFAULT 'MXN',
  idc_forma_pago INT NOT NULL REFERENCES c_forma_pago(idc_forma_pago),
  forma_pago TEXT,
  comentario TEXT,
  is_paid INT NOT NULL DEFAULT 1,
  is_active INT NOT NULL DEFAULT 1,
  f_alta TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venta_producto (
  id SERIAL PRIMARY KEY,
  uuid_venta_producto TEXT NOT NULL UNIQUE,
  uuid_venta TEXT NOT NULL REFERENCES venta(uuid_venta),
  uuid_producto TEXT NOT NULL REFERENCES producto(uuid_producto),
  uuid_departamento TEXT,
  cbarras TEXT NOT NULL,
  nombre_producto TEXT NOT NULL,
  unidad TEXT NOT NULL DEFAULT 'Pieza',
  precio_compra DOUBLE PRECISION NOT NULL DEFAULT 0,
  cantidad DOUBLE PRECISION NOT NULL,
  precio_unitario DOUBLE PRECISION NOT NULL,
  importe DOUBLE PRECISION NOT NULL,
  tasa_cuota_iva TEXT NOT NULL DEFAULT '0.16',
  iva_cobrado DOUBLE PRECISION NOT NULL DEFAULT 0,
  descuento DOUBLE PRECISION NOT NULL DEFAULT 0,
  total DOUBLE PRECISION NOT NULL,
  is_active INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS session (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  uuid_usuario TEXT NOT NULL REFERENCES usuario(uuid_usuario),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_producto_cbarras ON producto(cbarras);
CREATE INDEX IF NOT EXISTS idx_venta_corte ON venta(uuid_cortecaja);
CREATE INDEX IF NOT EXISTS idx_corte_open ON corte_caja(uuid_caja, is_closed);
