-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "categoria" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sku" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stock_minimo" INTEGER NOT NULL DEFAULT 5,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "peso_gramos" INTEGER,
    "variante" TEXT,
    "origen" TEXT,
    "tostado" TEXT,
    "imagen" TEXT NOT NULL DEFAULT '',
    "imagenes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bestseller" BOOLEAN NOT NULL DEFAULT false,
    "badge" TEXT,
    "agotado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "numero_orden" TEXT NOT NULL,
    "cliente_nombre" TEXT,
    "cliente_telefono" TEXT,
    "canal" TEXT NOT NULL DEFAULT 'directo',
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "estado_pago" TEXT NOT NULL DEFAULT 'pendiente',
    "metodo_pago" TEXT,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costo_envio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "direccion_entrega" TEXT,
    "ciudad_entrega" TEXT,
    "notas_internas" TEXT,
    "notas_entrega" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orden_id" TEXT NOT NULL,
    "producto_nombre" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Order_numero_orden_key" ON "Order"("numero_orden");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
