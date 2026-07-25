-- Give Order a real FK to the Customer it belongs to.
--
-- Until now the only link was the snapshot fields (cliente_email /
-- cliente_telefono), matched by value. That match is lossy: it fails whenever a
-- customer edits their email or phone, and it cannot distinguish two customers
-- who share a phone. createOrderWithCustomer already resolves the exact Customer
-- during its upsert — this column just records the id it had all along.
--
-- The snapshot columns STAY. They are the purchase-time record (who bought, as
-- stated then); the relation points at who that person is now. Editing a profile
-- must never rewrite past orders, so these are complementary, not redundant.
--
-- Nullable + ON DELETE SET NULL: historical orders may resolve to nobody, and
-- deleting a customer must never delete their orders — those are financial
-- records. The order survives with its snapshots intact and the link cleared.

ALTER TABLE "Order" ADD COLUMN "cliente_id" TEXT;

-- Orders-of-a-customer is the read this column exists for (profile history).
CREATE INDEX "Order_cliente_id_idx" ON "Order"("cliente_id");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "Customer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
