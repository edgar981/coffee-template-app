-- Cuenta para TRANSFERENCIAS bancarias del checkout — config, no un literal.
--
-- ANTES: el checkout mostraba una cuenta HARDCODEADA ("Bancolombia · Cta Ahorro ·
-- 123-456789-00"). Si el negocio lanza, un cliente real transfiere a un número inventado.
-- Estos cuatro campos la vuelven config editable, junto a la identidad de pago (whatsapp).
--
-- NULLABLE, SIN default y SIN backfill A PROPÓSITO: la fila existente (Nayoli) queda con las
-- cuatro en NULL. Vacío es el estado CORRECTO — el seed no trae una cuenta falsa; el dueño la
-- pone desde el panel. Con las esenciales vacías, el checkout NO muestra el método
-- "Transferencia" (guarda con banco+tipo+número; § checkout). Una cuenta falsa en la ruta del
-- dinero es peor que un método de pago menos.
--
-- Aditiva y compatible con el código anterior (columnas nullable): el deploy viejo ignora las
-- columnas mientras convive con el schema nuevo (§ Migraciones y deploy — la ventana).
ALTER TABLE "SiteSetting" ADD COLUMN "bancoNombre"       TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "bancoTipoCuenta"   TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "bancoNumeroCuenta" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "bancoTitular"      TEXT;
