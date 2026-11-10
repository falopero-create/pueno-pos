-- Remove previously shipped demo login accounts (known shared password).
-- Catalog seed remains; first admin must come from /setup or ADMIN_PASSWORD.

DELETE FROM session
WHERE uuid_usuario IN ('usr-admin-001', 'usr-super-001', 'usr-caja-001');

DELETE FROM usuario
WHERE uuid_usuario IN ('usr-admin-001', 'usr-super-001', 'usr-caja-001');
