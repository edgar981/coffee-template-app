-- Métodos de pago del checkout: encender/apagar por método, y el número de pago móvil PROPIO.
--
-- NATURALEZA: ADITIVA (5 columnas nuevas, nada se altera ni se borra) + UN BACKFILL de datos
-- (`pagoMovilNumero` ← `whatsapp`, una vez). El backfill no cambia comportamiento: copia el número
-- que hoy ya se usa como pago móvil, para separar el dato de contacto del de pago sin romper a Nayoli.
--
-- Los 4 métodos son FIJOS (nequi, daviplata, transferencia, efectivo) — no un motor de métodos
-- arbitrarios (eso es Wompi/pasarela, un flujo con webhooks, no "un método más"). Cada uno es un
-- BOOLEANO en SiteSetting; el dueño lo enciende/apaga desde Configuración.
--
-- BOOLEANOS NOT NULL DEFAULT true: la fila existente (Nayoli) queda con los 4 ENCENDIDOS, o sea el
-- comportamiento de hoy (un método se muestra si además tiene sus datos: transferencia→cuenta,
-- nequi/daviplata→número, efectivo→Bogotá). Aditiva y compatible con el deploy viejo.
ALTER TABLE "SiteSetting" ADD COLUMN "pagoNequiActivo"         BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SiteSetting" ADD COLUMN "pagoDaviplataActivo"     BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SiteSetting" ADD COLUMN "pagoTransferenciaActivo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SiteSetting" ADD COLUMN "pagoEfectivoActivo"      BOOLEAN NOT NULL DEFAULT true;

-- Nequi/Daviplata colgaban de `whatsapp` (conflación CONTACTO↔PAGO, accidental). El número de pago
-- móvil pasa a ser su PROPIO dato. Nullable, y esta migración lo SIEMBRA una vez desde el `whatsapp`
-- existente: las tiendas ya configuradas quedan igual, y los dos datos quedan separados de verdad
-- desde el primer día. Es dato de la propia migración que crea la columna, no una migración de
-- negocio — el backfill copia lo que hoy ya se está usando como número de pago.
ALTER TABLE "SiteSetting" ADD COLUMN "pagoMovilNumero" TEXT;
UPDATE "SiteSetting" SET "pagoMovilNumero" = "whatsapp" WHERE "pagoMovilNumero" IS NULL;
