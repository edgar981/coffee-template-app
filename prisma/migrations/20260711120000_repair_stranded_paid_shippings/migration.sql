-- One-time repair: a bug in the (now-removed) /status endpoint marked orders
-- `pagado` without auto-creating their Shipping, stranding them. Create a
-- `preparando` Shipping for every paid order that lacks one, snapshotting
-- address/city/cost from the order. Orders with a blank direccion_entrega still
-- get a Shipping, but it stays blocked from scheduling by the PATCH guard.
-- Idempotent via NOT EXISTS + the unique orden_id constraint.
INSERT INTO "Shipping" ("id", "orden_id", "direccion", "ciudad", "costo_envio", "estado", "zona", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  o."id",
  o."direccion_entrega",
  o."ciudad_entrega",
  o."costo_envio",
  'preparando',
  NULL,
  now(),
  now()
FROM "Order" o
WHERE o."estado" = 'pagado'
  AND NOT EXISTS (SELECT 1 FROM "Shipping" s WHERE s."orden_id" = o."id");
