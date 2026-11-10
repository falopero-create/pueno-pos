# Pueno Punto de Venta (clon web/PWA)

Reimplementación web del POS Pueno: menú por oficio, turnos, cobro y ticket.

## Local

```bash
npm install
npm run dev
```

Abrí http://127.0.0.1:3000 — credenciales demo: `admin` / `admin` (también `supervisor` y `cajero`).

Sin `DATABASE_URL` usa PGlite en memoria con migraciones + seed. Con `DATABASE_URL` (publish-app) usa Postgres.

## Stack

Next.js 15 · Postgres/PGlite · auth por sesión cookie · PWA manifest
