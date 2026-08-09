-- One-time data backfill.
--
-- Pre-existing orders (seed data, plus any checkout orders created before the
-- checkout handler began writing cliente_email) have a NULL cliente_email. The
-- customer's email lives on the Customer record, not the Order, and there is no
-- foreign key between them — the only available join key is the customer name.
--
-- Copy each order's email from the Customer whose `nombre` matches the order's
-- `cliente_nombre`, normalized to lowercase + trimmed (matching how the tracking
-- gate compares). Only fills rows that are currently NULL/empty, so this is
-- idempotent and safe to re-run. Orders whose name has no matching customer
-- with an email are left NULL and remain untrackable (no email exists for them).
UPDATE "Order" o
SET "cliente_email" = lower(trim(c."email"))
FROM "Customer" c
WHERE (o."cliente_email" IS NULL OR o."cliente_email" = '')
  AND o."cliente_nombre" = c."nombre"
  AND c."email" IS NOT NULL
  AND trim(c."email") <> '';
