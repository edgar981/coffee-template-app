@AGENTS.md

## Imágenes en `public/`

Los archivos de imagen en `public/` son inmutables: nunca sobrescribir
contenido bajo el mismo nombre. Todo reemplazo de imagen usa un nombre
nuevo (sufijo `-v2`, `-v3` o timestamp) y se actualizan las referencias
(DB, seed, código). Motivo: la URL es la clave de caché del navegador y
del optimizador de Next — mismo nombre con contenido nuevo = cachés
sirviendo la versión vieja indefinidamente. Cuando exista upload de
imágenes en el admin, el nombre debe incluir hash o timestamp
automáticamente.

## Política de tema (dark mode)

El storefront es light-only (paleta de marca fija). El admin soporta
dark mode con toggle. La política de tema se define en el layout de
cada grupo de rutas, nunca global — storefront y admin son productos
distintos que comparten repo temporalmente.

Implementación: `app/(storefront)/layout.tsx` monta
`StorefrontThemeProvider` (`forcedTheme="light"`);
`app/(admin)/layout.tsx` monta `AdminThemeProvider`
(`defaultTheme="system"` + `enableSystem`, toggle en TopBar). El root
layout NO monta ThemeProvider. `color-scheme` sigue al tema vía CSS
(`html` claro por defecto, `.dark` oscuro — solo el admin aplica
`.dark`).

## Migraciones y deploy

- Las migraciones de PRODUCCIÓN las aplica el build de Vercel
  automáticamente: `npm run build` corre `prisma migrate deploy` antes
  de `next build` **solo cuando `VERCEL_ENV === "production"`**. Si la
  migración falla, el build falla y el deploy queda bloqueado — jamás
  envolver ese paso en `|| true` (un deploy bloqueado con error claro es
  mejor que producción corriendo contra un schema sin migrar).
- Los PREVIEW deploys NO migran (variante condicionada, deliberada): una
  preview cuya rama trae una migración nueva fallará en runtime (P2022)
  hasta que `main` la aplique. Tradeoff aceptado frente al inverso —
  que una rama de feature migre la DB compartida antes de que `main`
  tenga el código.
- CONFIRMADO por el owner (2026-07-25): preview y producción COMPARTEN
  la misma base de Neon. La variante condicionada es por tanto la
  correcta — NO quitar la condición mientras esto siga así. Corolario:
  cualquier `migrate dev` o seed corrido desde local contra esa base
  también la toca — verificar a qué apunta `.env` antes de escrituras
  de prueba.
- `vercel.json#buildCommand` ANULA el script `build` de package.json —
  incidente 2026-07-25: decía `prisma generate && next build` y el
  `migrate deploy` condicionado nunca corrió en Vercel. Debe quedarse en
  `"npm run build"` (o eliminarse): package.json es la única fuente del
  build; `prisma generate` ya corre en `postinstall`. Todo cambio al
  pipeline de build se verifica en los LOGS del deploy de Vercel, no
  solo en el repo.
- **Jamás `prisma migrate reset` contra Neon** — borra toda la base.
- Migraciones nuevas deben ser aditivas/compatibles con el código
  anterior (columnas nullable o con default, enums nuevos) mientras un
  deploy viejo conviva con el schema nuevo; si algún día hay que romper,
  usar expand → migrate → contract en deploys separados.
- La env var `DIRECT_DATABASE_URL` (conexión directa de Neon, sin
  `-pooler`) debe existir en los entornos de Vercel que migran (hoy:
  Production). La lee `prisma.config.ts` — que consume SOLO el CLI de
  Prisma; el runtime usa `DATABASE_URL` (pooled) vía lib/prisma.ts.
  Prisma 7 no tiene `directUrl` en el config: esta separación de env
  vars es el equivalente.

## Design system del admin — chips de stat cards

Los icon chips de stat cards usan la paleta pastel multicolor (decisión
deliberada sobre la variante amber); rojo/destructive reservado para
estados de alerta reales.

## Dashboard personalizable — registry de widgets

Las stat cards del dashboard son un CATÁLOGO (`constants/dashboard-widgets.ts`,
`key` estable snake_case) con selección ordenada persistida por usuario
(`DashboardPreference.widgets` = array de keys; API `/api/dashboard/prefs`).
Toda entrada/salida pasa por `sanitizeWidgetKeys` (solo keys reales del registry,
sin duplicados, orden preservado) → una key retirada o un payload malicioso nunca
llega al grid. El binding key→dato vive en el dashboard (junto a los datos); el
registry es presentación pura + deep-links que reusan los helpers compartidos
(card=lista). SOLO las stat cards son personalizables: los gráficos y Órdenes
Recientes son fijos, fuera del sistema (v1).

- **Costura MULTITENANT (documentada, NO construida):** hoy no hay modelo de
  tienda/tenant. Cuando exista: (a) cada `WidgetDef` gana un filtro por vertical
  de negocio (el catálogo se scopea por vertical), (b) `DashboardPreference` gana
  la clave de tienda y su índice único pasa a compuesto (`userId + storeId`), y
  (c) `defaultVisible` se reemplaza por un set de default POR VERTICAL. La forma
  (registry + preferencia ordenada) ya es genérica del template "Comercio
  Digital"; el contenido (los widgets concretos) es de esta vertical.
- `DashboardPreference.userId` referencia `user.id` (Better Auth) pero SIN
  relación Prisma a propósito — una relación exigiría un campo inverso en el
  modelo `user` de Better Auth, que no se toca. Índice único; la app scopea por
  sesión.
- TODO (no implementado): el endpoint de stats calcula TODAS las métricas aunque
  el usuario muestre pocas tarjetas. Optimizar a cálculo selectivo por las keys
  visibles queda anotado, no hecho.
