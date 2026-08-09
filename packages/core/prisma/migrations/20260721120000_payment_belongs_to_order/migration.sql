-- Invertir el modelo de pagos: un Payment es ahora un evento DE una Order (FK
-- requerida), creado cuando el admin registra un pago recibido y la orden pasa a
-- `pagado` EN LA MISMA transacción. Reemplaza el ledger libre (cliente + monto
-- digitados a mano, sin vínculo con la orden).
--
-- DATOS: las 47 filas Payment existentes son de prueba/semilla, sin valor de
-- negocio — 41 sin vínculo a orden (ledger mock re-sembrado + "Molienda Test") y
-- 6 filas `pendiente` que el checkout viejo auto-creaba para órdenes de prueba
-- (Bogo Tester, Free Ship, …). Ninguna representa un pago real recibido → se
-- descartan (decisión confirmada antes de aplicar).

-- 1. Descartar todo el ledger viejo (tabla queda vacía → los cambios de tipo y
--    de nulabilidad siguientes son seguros sin casts ni backfills).
DELETE FROM "Payment";

-- 2. Método pasa a enum constreñido (extensible: WOMPI se agrega luego con
--    ALTER TYPE "MetodoPago" ADD VALUE 'WOMPI').
CREATE TYPE "MetodoPago" AS ENUM ('NEQUI', 'DAVIPLATA', 'EFECTIVO', 'TRANSFERENCIA', 'OTRO');

-- 3. Quitar columnas que ya no pertenecen al modelo invertido:
--    - estado: un Payment ES un pago recibido; pendiente/pagado vive en la Order.
--    - cliente_nombre: se lee en vivo vía la relación con Order (sin snapshot).
--    - fecha_pago (String): reemplazado por `fecha` (DateTime) más abajo.
ALTER TABLE "Payment"
  DROP COLUMN "estado",
  DROP COLUMN "cliente_nombre",
  DROP COLUMN "fecha_pago";

-- 4. Reemplazar metodo (TEXT) por el enum. Tabla vacía → swap directo, sin USING.
ALTER TABLE "Payment" DROP COLUMN "metodo";
ALTER TABLE "Payment" ADD COLUMN "metodo" "MetodoPago" NOT NULL;

-- 5. orden_id pasa a requerido y la FK cascada al borrar la orden (igual que
--    OrderItem y Shipping). La FK previa era ON DELETE SET NULL.
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_orden_id_fkey";
ALTER TABLE "Payment" ALTER COLUMN "orden_id" SET NOT NULL;
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_orden_id_fkey"
  FOREIGN KEY ("orden_id") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Auditoría: quién registró el pago (sesión admin), en snapshot para que
--    sobreviva el borrado del usuario.
ALTER TABLE "Payment" ADD COLUMN "registrado_por" TEXT;
ALTER TABLE "Payment" ADD COLUMN "registrado_por_nombre" TEXT;

-- 7. Fecha de pago (default = momento de registro). createdAt queda como la marca
--    de auditoría inmutable.
ALTER TABLE "Payment" ADD COLUMN "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 8. Índice de la FK para las consultas por orden y del ledger.
CREATE INDEX "Payment_orden_id_idx" ON "Payment"("orden_id");
