-- Idempotency key for order creation: a double submit / network retry reuses the
-- same key and returns the existing order instead of creating a duplicate.
-- Nullable + unique — Postgres allows multiple NULLs, so legacy and checkout
-- orders without a key are unaffected.
ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
