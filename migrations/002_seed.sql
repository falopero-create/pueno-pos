-- Seed demo: admin/admin, cajero, supervisor, productos, cliente público

INSERT INTO empresa (uuid_empresa, nombre_empresa, pais, cp, email_empresa, giro_comercial)
VALUES ('emp-matriz-001', 'Comercio Demo Pueno', 'México', '06600', 'demo@pueno.local', 'Abarrotes / Miscelánea')
ON CONFLICT (uuid_empresa) DO NOTHING;

INSERT INTO sucursal (uuid_sucursal, uuid_empresa, nombre_sucursal, calle, colonia, ciudad, estado, pais, cp, telefono)
VALUES ('suc-matriz-001', 'emp-matriz-001', 'MATRIZ', 'Av. Reforma 100', 'Juárez', 'Ciudad de México', 'CDMX', 'México', '06600', '5555000000')
ON CONFLICT (uuid_sucursal) DO NOTHING;

INSERT INTO c_tipo_usuario (idc_tipo_usuario, descripcion) VALUES
  (1, 'Administrador'),
  (2, 'Supervisor'),
  (3, 'Cajero'),
  (4, 'Consulta')
ON CONFLICT (idc_tipo_usuario) DO NOTHING;

-- password: admin  (bcrypt cost 10)
INSERT INTO usuario (uuid_usuario, uuid_sucursal, idtipo_usuario, username, password_hash, email, nombre, role, privilegios)
VALUES
  ('usr-admin-001', 'suc-matriz-001', 1, 'admin', '$2b$10$Xdlea9I8fkUO2bwbSxaaFe5BGC8Y9xvQ5QGRcQmUBlTMkPnQzjcyS', 'admin@demo.local', 'ADMINISTRADOR', 'admin', 'vender,descontar,cortar,inventario,usuarios,reportes,config'),
  ('usr-super-001', 'suc-matriz-001', 2, 'supervisor', '$2b$10$Xdlea9I8fkUO2bwbSxaaFe5BGC8Y9xvQ5QGRcQmUBlTMkPnQzjcyS', 'super@demo.local', 'SUPERVISOR DEMO', 'supervisor', 'vender,descontar,cortar,inventario,reportes'),
  ('usr-caja-001', 'suc-matriz-001', 3, 'cajero', '$2b$10$Xdlea9I8fkUO2bwbSxaaFe5BGC8Y9xvQ5QGRcQmUBlTMkPnQzjcyS', 'cajero@demo.local', 'CAJERO DEMO', 'cajero', 'vender')
ON CONFLICT (uuid_usuario) DO NOTHING;

INSERT INTO caja (uuid_caja, uuid_sucursal, clavecaja)
VALUES ('caja-prin-001', 'suc-matriz-001', 'PRINCIPAL / DPTO. GENERAL')
ON CONFLICT (uuid_caja) DO NOTHING;

INSERT INTO departamento (uuid_departamento, uuid_empresa, nombre_dep)
VALUES ('dep-gral-001', 'emp-matriz-001', 'GENERAL')
ON CONFLICT (uuid_departamento) DO NOTHING;

INSERT INTO categoria (uuid_categoria, uuid_departamento, nombre_categoria)
VALUES
  ('cat-beb-001', 'dep-gral-001', 'Bebidas'),
  ('cat-aba-001', 'dep-gral-001', 'Abarrotes'),
  ('cat-lim-001', 'dep-gral-001', 'Limpieza')
ON CONFLICT (uuid_categoria) DO NOTHING;

INSERT INTO proveedor (uuid_proveedor, razon_social, rfc)
VALUES ('prov-demo-001', 'Proveedor Demo SA', 'PDE010101AAA')
ON CONFLICT (uuid_proveedor) DO NOTHING;

INSERT INTO producto (uuid_producto, uuid_categoria, uuid_departamento, uuid_proveedor, cbarras, codigo_sat, nombre_producto, descripcion_producto, clave_unidad, inventario_min, tasa_cuota_iva)
VALUES
  ('prod-001', 'cat-beb-001', 'dep-gral-001', 'prov-demo-001', '7501000000011', '50202300', 'Agua 600ml', 'Agua purificada 600 ml', 'H87', 10, 0.16),
  ('prod-002', 'cat-beb-001', 'dep-gral-001', 'prov-demo-001', '7501000000028', '50202300', 'Refresco cola 355ml', 'Refresco de cola lata', 'H87', 12, 0.16),
  ('prod-003', 'cat-aba-001', 'dep-gral-001', 'prov-demo-001', '7501000000035', '50192900', 'Galletas surtidas 200g', 'Galletas dulces', 'H87', 8, 0.16),
  ('prod-004', 'cat-aba-001', 'dep-gral-001', 'prov-demo-001', '7501000000042', '50181900', 'Leche entera 1L', 'Leche pasteurizada', 'H87', 6, 0),
  ('prod-005', 'cat-lim-001', 'dep-gral-001', 'prov-demo-001', '7501000000059', '47131800', 'Detergente 1kg', 'Detergente en polvo', 'H87', 5, 0.16),
  ('prod-006', 'cat-aba-001', 'dep-gral-001', 'prov-demo-001', '7501000000066', '50161500', 'Pan de caja', 'Pan blanco rebanado', 'H87', 4, 0),
  ('prod-007', 'cat-beb-001', 'dep-gral-001', 'prov-demo-001', '7501000000073', '50202200', 'Jugo naranja 1L', 'Jugo de naranja', 'H87', 5, 0.16),
  ('prod-008', 'cat-lim-001', 'dep-gral-001', 'prov-demo-001', '7501000000080', '47131801', 'Jabón de manos 250ml', 'Jabón líquido', 'H87', 5, 0.16)
ON CONFLICT (uuid_producto) DO NOTHING;

INSERT INTO producto_sucursal (uuid_producto_sucursal, uuid_producto, uuid_sucursal, existencia, precio_compra, precio_venta, d_inv_min, d_inv_max)
VALUES
  ('ps-001', 'prod-001', 'suc-matriz-001', 48, 5.00, 12.00, 10, 100),
  ('ps-002', 'prod-002', 'suc-matriz-001', 36, 8.00, 18.00, 12, 80),
  ('ps-003', 'prod-003', 'suc-matriz-001', 24, 12.00, 28.00, 8, 60),
  ('ps-004', 'prod-004', 'suc-matriz-001', 20, 18.00, 32.00, 6, 40),
  ('ps-005', 'prod-005', 'suc-matriz-001', 15, 25.00, 49.00, 5, 40),
  ('ps-006', 'prod-006', 'suc-matriz-001', 18, 28.00, 45.00, 4, 30),
  ('ps-007', 'prod-007', 'suc-matriz-001', 22, 15.00, 29.00, 5, 50),
  ('ps-008', 'prod-008', 'suc-matriz-001', 14, 20.00, 38.00, 5, 40)
ON CONFLICT (uuid_producto_sucursal) DO NOTHING;

INSERT INTO cliente (uuid_cliente, uuid_sucursal, razon_social, rfc, email, telefono, estado, pais)
VALUES
  ('cli-publico-001', 'suc-matriz-001', 'PÚBLICO EN GENERAL', 'XAXX010101000', NULL, NULL, 'CDMX', 'México'),
  ('cli-demo-002', 'suc-matriz-001', 'Cliente Demo Contado', 'CDE010101BB1', 'cliente@demo.local', '5555112233', 'CDMX', 'México')
ON CONFLICT (uuid_cliente) DO NOTHING;

INSERT INTO c_forma_pago (idc_forma_pago, clave, descripcion_f_pago)
VALUES
  (1, '01', 'Efectivo'),
  (2, '04', 'Tarjeta de crédito'),
  (3, '28', 'Tarjeta de débito'),
  (4, '03', 'Transferencia'),
  (5, '99', 'Crédito tienda')
ON CONFLICT (idc_forma_pago) DO NOTHING;
