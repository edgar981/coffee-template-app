import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Tope de unidades por línea del storefront. Doble función: límite por pedido
// y cota de privacidad — el cliente recibe min(stock, tope) como `maxCompra`,
// así un inventario alto nunca se filtra por la API pública.
const MAX_UNIDADES_POR_LINEA = 20;

// Catálogo público del storefront — fuente única de producto para home,
// tienda, detalle y búsqueda. Solo productos activos y solo campos visibles
// para el cliente: sin costo, stock_minimo ni otros datos operativos del
// admin (/api/products, con auth, sigue siendo el endpoint completo).
//
// El número de stock NO se expone al cliente: se colapsa en `disponible`
// (estado Agotado) y `maxCompra` (tope del selector, acotado). El admin ve el
// stock completo por su endpoint autenticado.
export async function GET() {
  const products = await prisma.product.findMany({
    where:   { activo: true },
    orderBy: { createdAt: 'asc' },
    select: {
      id:                true,
      nombre:            true,
      slug:              true,
      categoria:         true,
      precio:            true,
      stock:             true,
      peso_gramos:       true,
      variante:          true,
      origen:            true,
      tostado:           true,
      descripcion:       true,
      descripcionCorta:  true,
      notas:             true,
      variedad:          true,
      proceso:           true,
      altitudMin:        true,
      altitudMax:        true,
      molienda:          true,
      moliendasOpciones: true,
      notasCata:         true,
      imagen:            true,
      imagenes:          true,
      bestseller:        true,
      badge:             true,
      agotado:           true,
    },
  });

  // Descartamos `stock` de la respuesta y derivamos los flags públicos.
  const publicos = products.map(({ stock, agotado, ...p }) => ({
    ...p,
    agotado,
    disponible: stock > 0 && !agotado,
    maxCompra:  Math.min(stock, MAX_UNIDADES_POR_LINEA),
  }));

  return NextResponse.json(publicos);
}
