-- Ficha técnica estructurada del producto (datos del empaque real), editable
-- desde el admin: variedad, proceso, altitud (rango), molienda (solo variantes
-- molidas), notas de cata y copy corto del card. La tostión reutiliza el campo
-- `tostado` ya existente. Columnas aditivas y anulables — sin pérdida de datos.
ALTER TABLE "Product" ADD COLUMN "variedad" TEXT;
ALTER TABLE "Product" ADD COLUMN "proceso" TEXT;
ALTER TABLE "Product" ADD COLUMN "altitudMin" INTEGER;
ALTER TABLE "Product" ADD COLUMN "altitudMax" INTEGER;
ALTER TABLE "Product" ADD COLUMN "molienda" TEXT;
ALTER TABLE "Product" ADD COLUMN "notasCata" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Product" ADD COLUMN "descripcionCorta" TEXT;
