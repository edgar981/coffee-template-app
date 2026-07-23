-- Separate Order (payment) and Shipping (fulfillment) status lifecycles.
--
-- Order.status:    Pendiente -> Pagado -> Cancelado   (fulfillment removed)
-- Shipping.status: Preparando -> En Ruta -> Entregado -> Fallido
--
-- Ordering matters: the Shipping backfill reads the ORIGINAL Order.status to
-- preserve fulfillment progress, so it MUST run before Order.status is collapsed.

-- 1. New snapshot columns + make zona nullable (courier/zona start empty).
ALTER TABLE "Shipping" ADD COLUMN "direccion" TEXT;
ALTER TABLE "Shipping" ADD COLUMN "ciudad" TEXT;
ALTER TABLE "Shipping" ALTER COLUMN "zona" DROP NOT NULL;
ALTER TABLE "Shipping" ALTER COLUMN "zona" DROP DEFAULT;
ALTER TABLE "Shipping" ALTER COLUMN "estado" SET DEFAULT 'preparando';

-- 2. Remap existing Shipping fulfillment states to the new enum.
UPDATE "Shipping" SET "estado" = 'preparando' WHERE "estado" = 'programado';
UPDATE "Shipping" SET "estado" = 'fallido'    WHERE "estado" = 'cancelado';

-- 3. Dedupe: keep the single most-progressed shipping per order, so orden_id can
--    become UNIQUE. (rank: entregado > en_ruta > fallido > preparando)
DELETE FROM "Shipping" s
USING "Shipping" other
WHERE s."orden_id" = other."orden_id"
  AND s."id" <> other."id"
  AND (
    CASE other."estado" WHEN 'entregado' THEN 4 WHEN 'en_ruta' THEN 3 WHEN 'fallido' THEN 2 ELSE 1 END,
    other."createdAt"
  ) > (
    CASE s."estado"     WHEN 'entregado' THEN 4 WHEN 'en_ruta' THEN 3 WHEN 'fallido' THEN 2 ELSE 1 END,
    s."createdAt"
  );

-- 4. Backfill a Shipping for every paid/fulfilled order that has none, snapshotting
--    address/city/cost from the order and preserving fulfillment progress.
INSERT INTO "Shipping" ("id", "orden_id", "direccion", "ciudad", "costo_envio", "estado", "zona", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  o."id",
  o."direccion_entrega",
  o."ciudad_entrega",
  o."costo_envio",
  CASE o."estado"
    WHEN 'entregado' THEN 'entregado'
    WHEN 'enviado'   THEN 'en_ruta'
    ELSE 'preparando'   -- preparando / pagado / confirmado
  END,
  NULL,
  now(),
  now()
FROM "Order" o
WHERE o."estado" IN ('confirmado', 'pagado', 'preparando', 'enviado', 'entregado')
  AND NOT EXISTS (SELECT 1 FROM "Shipping" s WHERE s."orden_id" = o."id");

-- 5. Backfill address/city snapshots for pre-existing shippings that predate the
--    snapshot columns, pulling from their order.
UPDATE "Shipping" s
SET "direccion" = o."direccion_entrega",
    "ciudad"    = o."ciudad_entrega"
FROM "Order" o
WHERE s."orden_id" = o."id" AND s."direccion" IS NULL;

-- 6. Collapse Order.status to the payment-only lifecycle. Pendiente/Cancelado
--    untouched; every fulfillment/confirmado state becomes Pagado.
UPDATE "Order" SET "estado" = 'pagado'
WHERE "estado" IN ('confirmado', 'preparando', 'enviado', 'entregado');

-- 7. Now that duplicates are gone, enforce 1:1.
CREATE UNIQUE INDEX "Shipping_orden_id_key" ON "Shipping"("orden_id");
