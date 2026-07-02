-- CreateTable
CREATE TABLE "Shipping" (
    "id" TEXT NOT NULL,
    "orden_id" TEXT,
    "numero_orden" TEXT,
    "cliente_nombre" TEXT,
    "direccion" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL DEFAULT 'Bogotá',
    "zona" TEXT NOT NULL DEFAULT 'centro',
    "estado" TEXT NOT NULL DEFAULT 'programado',
    "costo_envio" DOUBLE PRECISION NOT NULL DEFAULT 8000,
    "mensajero" TEXT,
    "notas_entrega" TEXT,
    "fecha_programada" TEXT,
    "fecha_entrega" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipping_pkey" PRIMARY KEY ("id")
);
