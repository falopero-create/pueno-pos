# Pueno Punto de Venta (clon web/PWA)

Reimplementación web del POS Pueno: menú por oficio, turnos, cobro y ticket.

## Local

```bash
npm install
npm run dev
```

Abrí http://127.0.0.1:3000. Si no hay usuarios, `/setup` crea el administrador inicial (la contraseña se elige ahí; no se embebe en el código).

Sin `DATABASE_URL` usa PGlite local con migraciones + catálogo. Con `DATABASE_URL` (publish-app) usa Postgres. En build, podés pasar `ADMIN_PASSWORD` (y opcional `ADMIN_USERNAME`) para crear el primer admin vía migrate.

## Stack

Next.js 15 · Postgres/PGlite · auth por sesión cookie · PWA manifest
