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

export interface Product {
  id: string;
  nombre: string;
  slug: string;
  categoria: ProductCategory;
  precio: number;
  costo: number;
  sku: string;
  stock: number;
  stock_minimo?: number;
  activo: boolean;
  peso_gramos?: number;
  variante?: string;
  origen?: string;
  tostado?: RoastLevel;
  descripcion: string;
  notas?: string[];
  proceso?: string;
  altitud?: string;
  imagen?: string;
  imagenes?: string[];
  bestseller?: boolean;
  badge?: string | null;
  agotado?: boolean;
  esSuscripcion?: boolean;
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
