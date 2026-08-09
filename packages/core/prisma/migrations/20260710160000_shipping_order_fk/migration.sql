-- Wire Shipping to its Order via a real FK, and stop Shipping from holding
-- independent copies of order-owned data (address, city, order number,
-- customer). costo_envio remains as a server-populated snapshot of the order's.

-- 1. Drop orphan deliveries: seed/demo rows whose orden_id never referenced a
--    real Order. Must run before adding the NOT NULL / FK constraints.
DELETE FROM "Shipping"
  WHERE "orden_id" IS NULL
     OR "orden_id" NOT IN (SELECT "id" FROM "Order");

-- 2. Remove the independent copies — these are now read through the relation.
ALTER TABLE "Shipping"
  DROP COLUMN "direccion",
  DROP COLUMN "ciudad",
  DROP COLUMN "numero_orden",
  DROP COLUMN "cliente_nombre";

-- 3. Every Shipping must reference an Order.
ALTER TABLE "Shipping" ALTER COLUMN "orden_id" SET NOT NULL;

-- 4. The FK itself.
ALTER TABLE "Shipping"
  ADD CONSTRAINT "Shipping_orden_id_fkey"
  FOREIGN KEY ("orden_id") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
