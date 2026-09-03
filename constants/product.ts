import { ProductForm, RoastLevel } from "@/types/product";

export const EMPTY_PRODUCT_FORM: ProductForm = {
  nombre: '', descripcion: '', categoria: '', precio: '', costo: '',
  sku: '', stock: '', stock_minimo: '5', activo: true,
  peso_gramos: '', variante: '', origen: '', tostado: '',
  slug: '', imagen: '',
};

// `CATEGORIAS` (el mapa de labels de las 6 categorías café) se RETIRÓ en C3: la taxonomía se DERIVA
// del catálogo (§ lib/productos/categorias) y el label es la categoría misma, sin mapa. `TOSTADOS`
// (abajo) se queda: es el vocabulario de tostado de un cliente cafetero.
export const TOSTADOS: Record<RoastLevel, string> = {
  ligero:   'Ligero',
  medio:    'Medio',
  oscuro:   'Oscuro',
  especial: 'Especial',
};
