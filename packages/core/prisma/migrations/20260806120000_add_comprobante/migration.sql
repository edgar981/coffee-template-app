-- CreateEnum
CREATE TYPE "ComprobanteEstado" AS ENUM ('RECIBIDO', 'VERIFICADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "Comprobante" (
    "id" TEXT NOT NULL,
    "orden_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "estado" "ComprobanteEstado" NOT NULL DEFAULT 'RECIBIDO',
    "subido_por" TEXT,
    "subido_por_nombre" TEXT,
    "verificado_por" TEXT,
    "verificado_por_nombre" TEXT,
    "verificado_at" TIMESTAMP(3),
    "notas_verificacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comprobante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comprobante_orden_id_idx" ON "Comprobante"("orden_id");

-- AddForeignKey
ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

