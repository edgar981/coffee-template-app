-- Raíces de paleta del storefront (commit 4 de la tanda de marca).
--
-- NULLABLE, SIN default y SIN backfill A PROPÓSITO: la fila existente (Nayoli) queda con
-- las tres en NULL. NULL = defaults de código (§ globals.css `--sf-*`), que es lo que
-- mantiene byte-idéntico el storefront de Nayoli SIN depender de una siembra. Un cliente
-- nuevo setea sus 3 raíces (fondo · tinta · acento) y el motor de derivación calcula las
-- 17 restantes; Nayoli no deriva.
--
-- Aditiva y compatible con el código anterior (columnas nullable): el deploy viejo ignora
-- las columnas mientras convive con el schema nuevo (§ Migraciones y deploy — la ventana).
ALTER TABLE "SiteSetting" ADD COLUMN "paletaFondo"  TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "paletaTinta"  TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "paletaAcento" TEXT;
