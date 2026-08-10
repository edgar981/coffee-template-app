-- Fuente única de producto: el storefront pasa a leer la DB (vía /api/catalog).
-- 1. Tags cortos del card (existían solo en el mock del frontend).
ALTER TABLE "Product" ADD COLUMN "notas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Product"
SET "notas" = ARRAY['Chocolate', 'Herbal', 'Balanceado']
WHERE "slug" LIKE 'cafe-nayoli-%';

-- 2. Desactivar los productos demo del template original para que no aparezcan
--    en el catálogo público al migrar el storefront a la DB. Se DESACTIVAN (no
--    se borran) para preservar el historial de pedidos que los referencia.
UPDATE "Product"
SET "activo" = false
WHERE "slug" IN (
  'cafe-sierra-250g',
  'cafe-narino-premium',
  'cold-brew-concentrado',
  'cold-brew-rtd',
  'cafe-molido-espresso',
  'caja-regalo-connoisseur',
  'suscripcion-esencial'
);
