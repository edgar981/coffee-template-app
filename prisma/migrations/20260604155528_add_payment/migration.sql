-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "cliente_nombre" TEXT,
    "monto" DOUBLE PRECISION NOT NULL,
    "metodo" TEXT NOT NULL DEFAULT 'transferencia',
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "referencia" TEXT,
    "notas" TEXT,
    "fecha_pago" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
