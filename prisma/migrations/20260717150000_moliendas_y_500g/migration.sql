-- 1. Opciones de molienda por producto (Json editable desde el admin) y
--    snapshot de la molienda elegida en cada línea de pedido.
ALTER TABLE "Product" ADD COLUMN "moliendasOpciones" JSONB;
ALTER TABLE "OrderItem" ADD COLUMN "moliendaSeleccionada" TEXT;

-- 2. Renombrar "1 lb" -> "500 g" y precios de catálogo vigentes.
--    Solo filas de catálogo (Product): los pedidos existentes y sus snapshots
--    de precio/nombre en OrderItem NO se tocan.
UPDATE "Product" SET
  "nombre"      = 'Café Nayoli — En grano 500 g',
  "slug"        = 'cafe-nayoli-grano-500g',
  "sku"         = 'NAY-G-500',
  "variante"    = 'En grano · 500 g',
  "peso_gramos" = 500,
  "precio"      = 35000,
  "imagen"      = '/images/cafe-nayoli-500g-grano.webp',
  "imagenes"    = ARRAY['/images/cafe-nayoli-500g-grano.webp']
WHERE "slug" = 'cafe-nayoli-grano-1lb';

UPDATE "Product" SET
  "nombre"      = 'Café Nayoli — Molido 500 g',
  "slug"        = 'cafe-nayoli-molido-500g',
  "sku"         = 'NAY-M-500',
  "variante"    = 'Molido · 500 g',
  "peso_gramos" = 500,
  "precio"      = 35000,
  "imagen"      = '/images/cafe-nayoli-500g-molido.webp',
  "imagenes"    = ARRAY['/images/cafe-nayoli-500g-molido.webp']
WHERE "slug" = 'cafe-nayoli-molido-1lb';

UPDATE "Product" SET "precio" = 20000
WHERE "slug" IN ('cafe-nayoli-grano-250g', 'cafe-nayoli-molido-250g');
