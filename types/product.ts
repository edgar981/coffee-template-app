export type ProductCategory =
  | "cafe_bolsa"
  | "cafe_grano"
  | "cafe_molido"
  | "cold_brew"
  | "caja_regalo"
  | "suscripcion";

export type RoastLevel =
  | "ligero"
  | "medio"
  | "oscuro"
  | "especial";

/** Una opción de molienda del selector de la página de producto. */
export interface MoliendaOpcion {
  nombre: string;
  /** Método de preparación sugerido (texto secundario del chip) */
  metodo: string;
  disponible: boolean;
}

export interface Product {
  id: string;
  nombre: string;
  slug: string;
  categoria: ProductCategory;
  precio: number;
  costo: number;
  /**
   * NULLABLE, como la columna (`sku String? @unique` en Prisma). Un producto
   * puede vivir sin SKU —el formulario no lo exige y el POST hace
   * `body.sku || null`— así que la API devuelve `null`, no `undefined`: por eso
   * es `string | null` y no `sku?: string`.
   *
   * Estuvo declarado `string` a secas y ese tipo MENTÍA. Costó un error de React
   * en pantalla: `openEdit` hacía `sku: p.sku` sin fallback —el único de los
   * nullables sin `?? ''`— y tsc no podía verlo porque, según el tipo, `p.sku`
   * siempre era string. Salió a la luz cuando el PATCH destructivo dejó un SKU
   * en null y el `<Input value={null}>` gritó. El bug era anterior e
   * independiente: cualquier producto creado sin SKU lo dispara igual.
   */
  sku: string | null;
  stock: number;
  stock_minimo?: number;
  activo: boolean;
  peso_gramos?: number;
  variante?: string;
  origen?: string;
  /** Tostión (ficha técnica) — "medio" = Tostión media */
  tostado?: RoastLevel;
  /** Descripción larga — página de detalle */
  descripcion: string;
  /** Copy corto — card del catálogo */
  descripcionCorta?: string;
  /** Tags cortos del card (p. ej. "Chocolate" · "Herbal" · "Balanceado") */
  notas?: string[];
  // Ficha técnica estructurada (espejo de los campos del modelo Prisma)
  variedad?: string;
  proceso?: string;
  altitudMin?: number;
  altitudMax?: number;
  /** Solo variantes molidas (p. ej. "Media"); undefined en grano entero */
  molienda?: string;
  /**
   * Opciones de molienda que ve el cliente (espejo del Json en Prisma).
   * El admin las edita en el modal de producto ("Opciones de molienda para el
   * cliente"): agregar, renombrar y activar con `disponible` — sin SQL ni
   * cambios de código. Distinto de `molienda`, que es ficha técnica.
   * Las reglas de escritura viven en `lib/moliendas-opciones` (`validarOpciones`).
   */
  moliendasOpciones?: MoliendaOpcion[];
  /** Notas de cata completas del empaque — detalle del producto */
  notasCata?: string[];
  imagen?: string;
  imagenes?: string[];
  bestseller?: boolean;
  badge?: string | null;
  agotado?: boolean;
  esSuscripcion?: boolean;
  /**
   * Disponibilidad pública del catálogo storefront (reemplaza a `stock`, que el
   * cliente nunca recibe). `true` = hay existencias y no está agotado.
   */
  disponible?: boolean;
  /**
   * Tope de unidades que el selector del storefront puede pedir por línea.
   * Acotado por un máximo por pedido para no revelar el stock real; el admin
   * ve el stock completo por /api/products.
   */
  maxCompra?: number;
}

export type ProductForm = {
  nombre:      string;
  descripcion: string;
  categoria:   ProductCategory | '';
  precio:      string;
  costo:       string;
  sku:         string;
  stock:       string;
  stock_minimo: string;
  activo:      boolean;
  peso_gramos: string;
  variante:    string;
  origen:      string;
  tostado:     RoastLevel | '';
  slug:        string;
  imagen:      string;
};
