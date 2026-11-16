# Wana

Consola de monitoreo e inteligencia para campañas políticas: figuras, eventos, menciones, temas y narrativas, alertas y reportes.

React + Vite + TypeScript. Datos, cuentas y reglas de acceso en Supabase. Despliegue estático en Vercel.

## Estado

Fase 1: la app lee y escribe en la base, con datos de ejemplo de un escenario hipotético (figuras públicas reales, cifras inventadas). La ingesta en vivo, las alertas automáticas y el envío de reportes por correo son la fase 2.

## Estructura

- `src/pages/` una pantalla por archivo. `src/shell/` barra lateral, sesión y acciones compartidas. `src/lib/` acceso a datos, tipos y formato.
- `supabase/migrations/` esquema (`001`), vistas (`800`), funciones (`850`) y reglas de acceso (`900`).
- `supabase/seed/*.json` datos de ejemplo por tabla. `node rig/semilla.mjs` los compila a `supabase/seed.sql`.
- `rig/` banco de pruebas local: Postgres con las mismas reglas que producción, una API mínima compatible con supabase-js, cuentas de prueba por rol y pruebas de acceso.
- `docs/CONSTRUIR.md` cómo construir una pantalla. `docs/semilla.md` qué datos de ejemplo hay.

## Acceso

Cada persona pertenece a un equipo. Ve solo las campañas donde es miembro, con un rol: Administración, Análisis, Solo lectura o Cliente (sin notas internas). Quien administra el equipo ve todas. No hay registro abierto: las cuentas se crean desde Supabase.

## Desarrollo local

Necesita Postgres 16 en `127.0.0.1:5432` con una base `iguana` y un rol `rig` (contraseña `rig`).

```bash
npm install
bash rig/reset.sh          # esquema + datos de ejemplo + cuentas de prueba
bash rig/arrancar.sh       # API local en :54321 y app en :5173
node rig/prueba-acceso.mjs # reglas de acceso
node rig/prueba-api.mjs    # capa de datos
```

Cuentas de prueba: `admin`, `analista`, `lector`, `cliente`, `ajeno` `@rig.test`, contraseña `iguana-rig`.

## Producción

Variables en Vercel: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. En Supabase: correr las migraciones en orden y `supabase/seed.sql`, y desactivar el registro público.
