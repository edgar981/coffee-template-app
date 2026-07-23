-- One-time repair: before cancellation propagated to the Shipping, cancelling
-- an order left its delivery orphaned in its prior state (e.g. preparando).
-- Void those deliveries as a state transition (never a delete) so cancelled
-- orders drop off the active dispatch board and stop offering delivery actions.
UPDATE "Shipping" s
SET "estado" = 'cancelado', "updatedAt" = now()
FROM "Order" o
WHERE s."orden_id" = o."id"
  AND o."estado" = 'cancelado'
  AND s."estado" <> 'cancelado';
