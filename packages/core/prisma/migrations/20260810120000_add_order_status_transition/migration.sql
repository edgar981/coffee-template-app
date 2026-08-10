-- CreateTable
CREATE TABLE "OrderStatusTransition" (
    "id" TEXT NOT NULL,
    "orden_id" TEXT NOT NULL,
    "eje" TEXT NOT NULL,
    "estado_anterior" TEXT,
    "estado_nuevo" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_nombre" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderStatusTransition_orden_id_occurred_at_idx" ON "OrderStatusTransition"("orden_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "OrderStatusTransition" ADD CONSTRAINT "OrderStatusTransition_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

