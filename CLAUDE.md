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
  tenga el código. Si preview y producción usan DBs separadas, se puede
  quitar la condición.
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
