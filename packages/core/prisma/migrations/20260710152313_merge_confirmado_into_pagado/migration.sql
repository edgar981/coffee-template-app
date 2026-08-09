-- Collapse order statuses 6 → 5: merge "confirmado" into "pagado".
-- In the manual-payment flow, payment confirmed = order confirmed, so both
-- represented the same moment. "pagado" is the surviving status.
UPDATE "Order" SET "estado" = 'pagado' WHERE "estado" = 'confirmado';
