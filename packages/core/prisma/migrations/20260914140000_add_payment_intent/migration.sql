-- CreateEnum
CREATE TYPE "PaymentIntentEstado" AS ENUM ('EN_VUELO', 'APROBADO', 'FALLIDO');

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "orden_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "estado" "PaymentIntentEstado" NOT NULL DEFAULT 'EN_VUELO',
    "monto_esperado" DOUBLE PRECISION NOT NULL,
    "pspTransactionId" TEXT,
    "estado_crudo_psp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_reference_key" ON "PaymentIntent"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_pspTransactionId_key" ON "PaymentIntent"("pspTransactionId");

-- CreateIndex
CREATE INDEX "PaymentIntent_orden_id_idx" ON "PaymentIntent"("orden_id");

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
