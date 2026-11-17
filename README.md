# Mi Puesto

ERP ligero para pequeños comercios de Lima: productos y stock, ventas, caja diaria y fiados, pensado para el celular.
El nombre es provisional y se cambia en un solo lugar: `src/config/app.ts`.

**Estado:** fase (a) terminada — ingreso, negocio (multi-tenant), roles, productos, variantes y stock.
Ventas, caja, fiados, dashboard, importación de Excel y modo sin conexión llegan en las fases (b) a (g). El avance está en `DEVLOG.md`.

## Requisitos

- Node 20 o superior.
- Una cuenta gratuita en [supabase.com](https://supabase.com).

## 1. Instalar

```bash
npm install
```

## 2. Crear el proyecto en Supabase

1. En supabase.com → **New project**. Elige un nombre, una contraseña de base de datos (guárdala) y la región **South America (São Paulo)**, la más cercana a Lima.
2. **Aplicar las migraciones.** Opción simple: abre **SQL Editor**, pega el contenido de cada archivo de `supabase/migrations/` **en orden** (`0001_core.sql`, luego `0002_products_stock.sql`) y pulsa **Run** en cada uno.
   Opción con CLI (útil más adelante, cuando haya más migraciones):
   ```bash
   npx supabase login
   npx supabase link --project-ref TU_REF     # el ref está en la URL del proyecto
   npx supabase db push
   ```
3. **Configurar el ingreso por correo.** En **Authentication → URL Configuration**:
   - *Site URL*: `http://localhost:5173` (cámbiala por tu dominio al desplegar).
   - *Redirect URLs*: agrega `http://localhost:5173/**` y, luego, `https://tu-dominio/**`.
4. **Agregar el código al correo (recomendado).** En **Authentication → Emails → Magic Link**, añade al cuerpo de la plantilla:
   ```html
   <p>O escribe este código en la app: <strong>{{ .Token }}</strong></p>
   ```
   Así se puede entrar escribiendo el código cuando el enlace se abre en otro navegador (pasa con la app instalada en el celular).

> El correo incluido en Supabase solo envía unos pocos mensajes por hora. Para pruebas alcanza (la sesión queda guardada); para producción configura un SMTP propio en **Authentication → Emails → SMTP Settings**.

## 3. Variables de entorno

Copia `.env.example` como `.env.local` y completa:

| Variable | Dónde está |
|---|---|
| `VITE_SUPABASE_URL` | Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API Keys → clave **publishable** (o `anon`) |

Nunca pongas la clave `service_role` / `secret` en la app: salta todas las reglas de seguridad.

## 4. Ejecutar

```bash
npm run dev        # http://localhost:5173
npm run dev:lan    # para abrirla desde el celular en la misma red wifi
```

Entra con tu correo, toca el enlace que te llega y crea tu negocio.

## 5. Cargar los datos de ejemplo

Después de crear tu negocio en la app, pega `supabase/seed.sql` en el **SQL Editor** y ejecútalo.
Carga un puesto de uniformes y útiles escolares: 6 categorías, 29 productos (5 con tallas), costos y stock, con algunos agotados y con stock bajo para ver las alertas. Se puede ejecutar más de una vez sin duplicar.

## 6. Tests

```bash
npm test
```

- `tests/domain`: reglas puras (precio por mayor, estado del stock, formato de soles, búsqueda).
- `tests/db`: las migraciones reales contra un Postgres embebido (PGlite): aislamiento entre negocios, permisos de dueño y vendedor, y que el stock solo cambie por movimientos. No necesita Docker ni conexión.

## 7. Desplegar (Vercel o Netlify)

- Comando de build: `npm run build` · carpeta de salida: `dist`.
- Define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en las variables de entorno del sitio.
- Como es una app de una sola página, todas las rutas deben servir `index.html`:
  - Vercel: `vercel.json` con `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
  - Netlify: `public/_redirects` con `/*  /index.html  200`
- Agrega el dominio final a *Site URL* y *Redirect URLs* en Supabase (paso 2.3).

## Cómo está armado

```
supabase/migrations   esquema, RLS y funciones (la fuente de verdad de las reglas)
supabase/seed.sql     datos de ejemplo
src/config            nombre de la app, moneda y feature flags
src/domain            reglas de negocio puras, con tests
src/lib               cliente de Supabase, formato, errores
src/features          pantallas por módulo (auth, products, dashboard, settings…)
src/components        piezas compartidas (barra inferior, encabezado, campos)
tests                 tests de dominio y de base de datos
```

Reglas de seguridad que conviene conocer:

- **Cada negocio es una `organization`.** Todas las tablas llevan `organization_id` y políticas RLS; un negocio nunca ve datos de otro.
- **Roles:** `owner` hace todo; `seller` consulta productos y stock (y venderá), pero no ve costos ni edita.
- **El costo vive en `product_costs`**, tabla aparte solo para el dueño, porque RLS filtra filas y no columnas.
- **El stock nunca se escribe desde la app.** La app no tiene permiso sobre `products.stock`: solo cambia mediante `stock_movements`, que se insertan desde funciones (`adjust_stock`, y luego ventas) dentro de una transacción.
- **Un producto con variantes** (tallas, colores) no lleva stock propio: lo lleva cada variante.
