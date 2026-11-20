# DEVLOG — Mi Puesto

## 2026-11-16 / 17 — Propuesta y fase (a)

**Acordado con el usuario**

- Modelo de datos, carpetas, pantallas y navegación de la propuesta inicial: confirmados.
- Un solo método de pago por venta (sin pagos mixtos en el MVP).
- Stock negativo permitido, con aviso.
- Se puede vender sin caja abierta, con aviso; esas ventas entran a la caja que se abra ese día.
- Nota de venta sin conexión: código provisional, correlativo definitivo al sincronizar.
- Datos de ejemplo: puesto de **uniformes y útiles escolares** (ya no iluminación LED).
- El usuario aún no tiene proyecto en Supabase; lo crea siguiendo el README.

**Hecho en la fase (a): auth, organizaciones, productos y stock**

- Proyecto Vite + React 19 + TypeScript, UI5 Web Components for React (tema sap_horizon), React Router, TanStack Query, supabase-js.
- `supabase/migrations/0001_core.sql`: organizations, memberships, invitations; helpers `is_member` / `is_owner`; RPC `create_organization` (idempotente) y `accept_invitations`; RLS y permisos explícitos.
- `supabase/migrations/0002_products_stock.sql`: categories, products (variantes con `parent_id`), product_costs (solo dueño), stock_movements; trigger que aplica el movimiento al stock; trigger de reglas de variantes; RPC `adjust_stock` (idempotente por id de movimiento).
- `supabase/seed.sql`: 6 categorías, 29 productos (5 con 5 tallas cada uno), costos y stock inicial.
- Pantallas: ingreso (enlace mágico + código), crear negocio, inicio (productos, stock bajo, agotados), lista de productos con búsqueda y filtros, ficha de producto con movimientos, formulario de producto y de variante, diálogo de stock (entrada / salida / conteo), "Más", mi negocio y vendedores (invitar / quitar).
- Tests: 29 en verde (`npm test`). Dominio (precio por mayor, estado de stock, formato, búsqueda) y base de datos con PGlite (aislamiento entre negocios, roles, stock solo por movimientos, variantes, seed).

**Verificado / no verificado**

- Verificado: `tsc`, `vite build` y los 29 tests.
- NO verificado: la app en el navegador contra un Supabase real (no hay proyecto todavía). Lo prueba el usuario al terminar la fase.

**Pendientes anotados**

- El bundle principal pesa ~1 MB (252 kB gzip). Revisar en la fase (g): división por rutas e imports por componente de UI5.
- Escaneo de código de barras: flag `FEATURES.barcodeScanner` creado; se implementa con la pantalla de ventas (fase b).
- OTP por celular: flag `FEATURES.phoneOtp` creado; falta proveedor de SMS.
- Seed: clientes con deuda y 30 ventas se agregan en las fases (b) y (d).
- Faltan `vercel.json` / `_redirects` (se agregan al preparar el despliegue, fase g).

**Siguiente:** fase (b) ventas y pedidos, cuando el usuario confirme que la fase (a) funciona.

## 2026-11-17 — Despliegue en Vercel: 404 NOT_FOUND

- Síntoma: el proyecto `hidalgoerp` de Vercel responde 404 en la raíz.
- Causa: en GitHub (`alestar328/HidalgoERP`, rama `main`) solo está commiteado `README.md`; todo el código sigue sin añadir a git (`git status` lo muestra como untracked). Vercel desplegó un repo sin app.
- Hecho: añadido `vercel.json` (framework vite + rewrite de todas las rutas a `/index.html`, necesario por `BrowserRouter`). `npm run build` pasa en local.
- Pendiente del usuario: commit + push de todo el código; en Vercel poner `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (Settings → Environment Variables) y redesplegar; en Supabase añadir la URL de Vercel en Auth → URL Configuration para el enlace mágico.

## 2026-11-17 — Despliegue en Vercel: variables y Supabase Auth

- Código ya commiteado y subido (`d08e2b0 App Mi Puesto: fase (a)`); el 404 dejó de salir y la app carga en Vercel.
- Síntoma siguiente: la app mostraba su pantalla "Crea el archivo .env.local…". Causa: `.env.local` no se sube a git y Vercel no tenía las variables.
- Hecho por el usuario (lo confirma él, no verificado desde aquí): `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` puestas en Vercel → Settings → Environment Variables. Vite las incrusta al compilar: hace falta **Redeploy** tras cambiarlas.
- Supabase Auth → URL Configuration: usar el dominio estable `https://hidalgoerp.vercel.app` (Site URL) y `https://hidalgoerp.vercel.app/**` (Redirect URLs), más `http://localhost:5173/**` para local. No usar la URL del deployment (`hidalgoerp-<hash>-ales-projects-76f6085a.vercel.app`): cambia en cada push.
- Ojo: `LoginPage.tsx` usa `emailRedirectTo: window.location.origin`, así que hay que entrar siempre por `hidalgoerp.vercel.app` para que el enlace mágico vuelva a una URL permitida.
- NO verificado: ingreso completo con enlace mágico en producción. Falta que el usuario lo pruebe.
