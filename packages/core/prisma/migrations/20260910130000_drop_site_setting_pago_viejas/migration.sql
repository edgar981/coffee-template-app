-- Las 9 columnas viejas de pago de SiteSetting se DROPEAN (§ PAGOS-METODOS-DROP-VIEJAS-1). Su
-- dato se mudó a `metodosPago` (Json, la LISTA de métodos) en la migración
-- `20260910120000_site_setting_metodos_pago`, que las leyó UNA VEZ para el backfill y las dejó
-- CONGELADAS sin lectores. Esta migración retira esa marcha atrás: hasta hoy, si el backfill
-- hubiera salido mal, las 9 columnas seguían ahí para reconstruir `metodosPago` a mano. Ese
-- respaldo ya no existe después de este DROP.
--
-- NATURALEZA: destructiva, CONTRAE el schema — el reemplazo de la sección "expand" del ciclo
-- expand → migrate → contract que abrió `20260910120000_site_setting_metodos_pago`.
--
-- POR QUÉ ES SEGURO AHORA (§ CLAUDE.md — LA VENTANA del `migrate deploy`): un DROP no es atómico
-- con el código — `migrate deploy` corre ANTES de `next build`, contra la base, mientras el
-- deploy VIEJO sigue sirviendo tráfico; si el código viejo todavía leyera estas columnas, la
-- ventana entre el drop y el swap del deploy nuevo daría 42703 en cada request que las tocara.
-- Ese riesgo ya se cerró: el código que dejó de leerlas —`app/api/site-settings/route.ts` sin
-- escribirlas, el loader `readSiteSettings`/`getSiteSettings` sin proyectarlas, el checkout
-- (`lib/checkout/metodos-pago.ts`) leyendo `metodosPago`, el editor de Configuración sin sus
-- campos— viajó en el merge `7122843` (slice/pagos-metodos-lista-1) y ya está en línea en
-- producción. Éste es, por tanto, el DEPLOY 2 (contraer el schema); el DEPLOY 1 (contraer el
-- código) ya ocurrió — code-first, como manda la regla.
ALTER TABLE "SiteSetting" DROP COLUMN "bancoNombre";
ALTER TABLE "SiteSetting" DROP COLUMN "bancoTipoCuenta";
ALTER TABLE "SiteSetting" DROP COLUMN "bancoNumeroCuenta";
ALTER TABLE "SiteSetting" DROP COLUMN "bancoTitular";
ALTER TABLE "SiteSetting" DROP COLUMN "pagoNequiActivo";
ALTER TABLE "SiteSetting" DROP COLUMN "pagoDaviplataActivo";
ALTER TABLE "SiteSetting" DROP COLUMN "pagoTransferenciaActivo";
ALTER TABLE "SiteSetting" DROP COLUMN "pagoEfectivoActivo";
ALTER TABLE "SiteSetting" DROP COLUMN "pagoMovilNumero";
