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

## Design system del admin — chips de stat cards

Los icon chips de stat cards usan la paleta pastel multicolor (decisión
deliberada sobre la variante amber); rojo/destructive reservado para
estados de alerta reales.
