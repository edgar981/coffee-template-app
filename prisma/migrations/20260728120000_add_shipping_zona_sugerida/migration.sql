-- AlterTable
-- Aditiva: columna nullable, sin default y sin tocar columnas existentes. Un
-- deploy anterior (que no la conoce) sigue funcionando contra este schema.
ALTER TABLE "Shipping" ADD COLUMN     "zona_sugerida" TEXT;
