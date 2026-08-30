-- Raíces de paleta del storefront: se RETIRAN de SiteSetting (§ Backlog #55). La paleta se mudó a
-- `SiteContent.content.tema` para ganar el flujo borrador/publicar — la frontera borrador/no-borrador
-- pasó a ser de PANTALLA: Configuración = identidad del negocio (guardar = en vivo al instante),
-- Tienda = lo que se publica. El código que dejó de leer estas columnas (el layout del storefront
-- re-fuenteado a `content.tema`, el loader `readSiteSettings` sin estos campos, y el editor mudado a
-- /admin/tienda) viaja en ESTE mismo deploy que el DROP, nunca en uno posterior.
--
-- LA VENTANA del migrate deploy (§ Migraciones y deploy): `migrate deploy` corre ANTES de
-- `next build`, contra producción, mientras el deploy VIEJO sigue sirviendo. Un DROP COLUMN abre la
-- ventana en que el código VIEJO hace SELECT de una columna que ya no existe → 42703. Y el
-- discriminador correcto: un SELECT de columna dropeada falla TENGA O NO datos — que Nayoli las
-- tenga en NULL no cierra la ventana, sólo garantiza que no hay dato que perder.
--
-- LA CONDICIÓN QUE LO VUELVE SEGURO NO ES "SIN TRÁFICO" — es UN SOLO USUARIO DEL PANEL. A diferencia
-- de un DROP sobre una tabla que sólo lee el storefront público (p. ej. Product.agotado), SiteSetting
-- la lee TAMBIÉN el admin: el layout del panel hace `getSiteSettings()` en cada request. Así que la
-- exposición de la ventana es EL OWNER recibiendo un 500 durante los ~1–3 min del build,
-- auto-recuperable al recargar — no corrupción. Con un solo usuario del panel es aceptable; con un
-- EQUIPO, no: ahí esta clase de cambio vuelve a DOS deploys (code-first — Deploy 1 deja de leer las
-- columnas, Deploy 2 las dropea).
ALTER TABLE "SiteSetting" DROP COLUMN "paletaFondo";
ALTER TABLE "SiteSetting" DROP COLUMN "paletaTinta";
ALTER TABLE "SiteSetting" DROP COLUMN "paletaAcento";
