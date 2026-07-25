-- CreateEnum
CREATE TYPE "CondicionPago" AS ENUM ('ANTICIPADO', 'CONTRAENTREGA');

-- CreateEnum
CREATE TYPE "TipoEnvio" AS ENUM ('LOCAL', 'NACIONAL');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "condicion_pago" "CondicionPago" NOT NULL DEFAULT 'ANTICIPADO';

-- AlterTable
ALTER TABLE "Shipping" ADD COLUMN     "numero_guia" TEXT,
ADD COLUMN     "stock_descontado_at" TIMESTAMP(3),
ADD COLUMN     "tipo_envio" "TipoEnvio" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "transportadora" TEXT,
ALTER COLUMN "costo_envio" SET DEFAULT 0;
