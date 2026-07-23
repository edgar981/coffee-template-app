import { MoliendaOpcion, Product } from "@/types/product";

// ── Opciones de molienda (seed del Json editable desde el admin) ──────────────
// Escala completa de gruesa a fina; hoy solo "Media" está disponible. El
// cliente activa nuevas moliendas cambiando `disponible` en el admin.
export const MOLIENDAS_MOLIDO: MoliendaOpcion[] = [
  { nombre: "Extra gruesa", metodo: "Cold brew",                 disponible: false },
  { nombre: "Gruesa",       metodo: "Prensa francesa",           disponible: false },
  { nombre: "Media-gruesa", metodo: "Chemex / Percolador",       disponible: false },
  { nombre: "Media",        metodo: "Filtro / Greca tradicional", disponible: true },
  { nombre: "Media-fina",   metodo: "V60 / Cono",                disponible: false },
  { nombre: "Fina",         metodo: "Moka / Espresso",           disponible: false },
  { nombre: "Extra fina",   metodo: "Café turco",                disponible: false },
];

// Producto en grano: una sola presentación, seleccionada.
export const MOLIENDAS_GRANO: MoliendaOpcion[] = [
  { nombre: "Grano entero", metodo: "Muele en casa a tu gusto", disponible: true },
];

// ── Ficha técnica del empaque real (fuente de verdad) ─────────────────────────
// Altitud 1.650–2.100 m s.n.m. · Variedad Castillo · Proceso lavado · Tostión
// media · Molienda media (solo Molido) · Café de especialidad · 100% colombiano.

// Tags cortos del card del catálogo
const NAYOLI_TAGS = ["Chocolate", "Herbal", "Balanceado"];

// Notas de cata completas del empaque (detalle del producto)
const NAYOLI_NOTAS_CATA = [
  "Fragancia a chocolate",
  "Aroma herbal e intenso",
  "Balance entre acidez y cuerpo medio",
];

// Descripción larga — página de detalle (igual para las 4 variantes)
const NAYOLI_DESCRIPCION =
  "Café de especialidad cultivado en la Finca Nayoli, en la vereda Providencia de Supatá, Cundinamarca, entre los 1.650 y 2.100 metros sobre el nivel del mar. Trabajamos una sola variedad, Castillo, con proceso lavado: una taza con fragancia a chocolate, aroma herbal e intenso, y un balance preciso entre acidez y cuerpo. Tostado artesanal en tandas semanales, producido directamente por caficultores de la región. No es solo café: es el trabajo honesto de una familia del campo colombiano.";

// Descripción corta — card del catálogo
const NAYOLI_DESCRIPCION_CORTA =
  "Origen único de Supatá — variedad Castillo, proceso lavado, tostión media.";

const NAYOLI_FICHA = {
  origen: "Supatá, Cundinamarca",
  tostado: "medio" as const,
  variedad: "Castillo",
  proceso: "Lavado",
  altitudMin: 1650,
  altitudMax: 2100,
  descripcion: NAYOLI_DESCRIPCION,
  descripcionCorta: NAYOLI_DESCRIPCION_CORTA,
  notas: NAYOLI_TAGS,
  notasCata: NAYOLI_NOTAS_CATA,
};

export const DEMO_PRODUCTS: Product[] = [
  {
    id: "nayoli-250g-grano",
    nombre: "Café Nayoli — En grano 250 g",
    slug: "cafe-nayoli-grano-250g",
    categoria: "cafe_grano",
    precio: 20000,
    costo: 14000,
    sku: "NAY-G-250",
    stock: 42,
    stock_minimo: 10,
    activo: true,
    peso_gramos: 250,
    variante: "En grano · 250 g",
    ...NAYOLI_FICHA,
    moliendasOpciones: MOLIENDAS_GRANO,
    imagen: "/images/cafe-nayoli-250g-grano.webp",
    imagenes: ["/images/cafe-nayoli-250g-grano.webp"],
    bestseller: true,
    badge: "Más vendido",
  },
  {
    id: "nayoli-250g-molido",
    nombre: "Café Nayoli — Molido 250 g",
    slug: "cafe-nayoli-molido-250g",
    categoria: "cafe_molido",
    precio: 20000,
    costo: 14000,
    sku: "NAY-M-250",
    stock: 42,
    stock_minimo: 10,
    activo: true,
    peso_gramos: 250,
    variante: "Molido · 250 g",
    ...NAYOLI_FICHA,
    molienda: "Media",
    moliendasOpciones: MOLIENDAS_MOLIDO,
    imagen: "/images/cafe-nayoli-250g-molido.webp",
    imagenes: ["/images/cafe-nayoli-250g-molido.webp"],
    bestseller: false,
    badge: null,
  },
  {
    id: "nayoli-500g-grano",
    nombre: "Café Nayoli — En grano 500 g",
    slug: "cafe-nayoli-grano-500g",
    categoria: "cafe_grano",
    precio: 35000,
    costo: 24000,
    sku: "NAY-G-500",
    stock: 28,
    stock_minimo: 8,
    activo: true,
    peso_gramos: 500,
    variante: "En grano · 500 g",
    ...NAYOLI_FICHA,
    moliendasOpciones: MOLIENDAS_GRANO,
    imagen: "/images/cafe-nayoli-500g-grano-v2.webp",
    imagenes: ["/images/cafe-nayoli-500g-grano-v2.webp"],
    bestseller: true,
    badge: "Ahorra más",
  },
  {
    id: "nayoli-500g-molido",
    nombre: "Café Nayoli — Molido 500 g",
    slug: "cafe-nayoli-molido-500g",
    categoria: "cafe_molido",
    precio: 35000,
    costo: 24000,
    sku: "NAY-M-500",
    stock: 28,
    stock_minimo: 8,
    activo: true,
    peso_gramos: 500,
    variante: "Molido · 500 g",
    ...NAYOLI_FICHA,
    molienda: "Media",
    moliendasOpciones: MOLIENDAS_MOLIDO,
    imagen: "/images/cafe-nayoli-500g-molido-v2.webp",
    imagenes: ["/images/cafe-nayoli-500g-molido-v2.webp"],
    bestseller: false,
    badge: null,
  },
];
