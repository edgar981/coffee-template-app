-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "ciudad" TEXT,
    "direccion" TEXT,
    "canal" TEXT DEFAULT 'directo',
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "numero_ordenes" INTEGER NOT NULL DEFAULT 0,
    "total_compras" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");
