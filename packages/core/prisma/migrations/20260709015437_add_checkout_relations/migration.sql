-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "precio_unitario" DOUBLE PRECISION,
ADD COLUMN     "producto_id" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "orden_id" TEXT;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
