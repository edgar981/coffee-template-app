import { ProductCategory, ProductForm, RoastLevel } from "@/types/product";

export const EMPTY_PRODUCT_FORM: ProductForm = {
  nombre: '', descripcion: '', categoria: '', precio: '', costo: '',
  sku: '', stock: '', stock_minimo: '5', activo: true,
  peso_gramos: '', variante: '', origen: '', tostado: '',
  slug: '', imagen: '',
};

export const CATEGORIAS: Record<ProductCategory, string> = {
  cafe_bolsa:  'Café Bolsa',
  cafe_grano:  'Café Grano',
  cafe_molido: 'Café Molido',
  cold_brew:   'Cold Brew',
  caja_regalo: 'Caja Regalo',
  suscripcion: 'Suscripción',
};

export const TOSTADOS: Record<RoastLevel, string> = {
  ligero:   'Ligero',
  medio:    'Medio',
  oscuro:   'Oscuro',
  especial: 'Especial',
};
