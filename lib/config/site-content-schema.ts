import { z } from 'zod';

// Forma EDITABLE del contenido del storefront. La corren el PATCH (la que MANDA) y el editor
// (aviso temprano) — como el schema de SiteSetting.
//
// SOFT a propósito: todo OPCIONAL y SIN `min(1)` —el vacío es un estado legítimo—, al
// revés de `siteSettingsEditableSchema` (que exige no-vacío porque su loader falla ruidoso).
// Acá se valida sólo el TIPO; el resolver aplica default (requerido) u omisión (opcional).
const heroEditableSchema = z.object({
  visible: z.boolean().optional(),
  eyebrow: z.string().optional(),
  titulo: z.string().optional(),
  tituloEnfasis: z.string().optional(),
  subtitulo: z.string().optional(),
  ctaPrimarioLabel: z.string().optional(),
  ctaSecundarioLabel: z.string().optional(),
  // Path estático (`/images/…`) o URL de Blob — el modelo acepta ambos, así que sólo string.
  imagen: z.string().optional(),
});

// BrandStory: h2 en UN campo (`titulo`), dos párrafos, cuatro imágenes FIJAS. `visible` porque
// es la primera sección ocultable. Todo opcional/SOFT, como el hero: el resolver decide.
const brandStoryEditableSchema = z.object({
  visible: z.boolean().optional(),
  eyebrow: z.string().optional(),
  titulo: z.string().optional(),
  parrafo1: z.string().optional(),
  parrafo2: z.string().optional(),
  imagen1: z.string().optional(),
  imagen2: z.string().optional(),
  imagen3: z.string().optional(),
  imagen4: z.string().optional(),
});

// SubscriptionCTA: solo texto (sin imágenes). `bullet1..4` opcionales — el resolver los omite
// vacíos y el componente los junta con `.filter` (hasta 4, sin hueco). `ctaLabel` editable; el href
// es estructura. Todo opcional/SOFT, como los otros.
const subscriptionCTAEditableSchema = z.object({
  visible: z.boolean().optional(),
  eyebrow: z.string().optional(),
  titulo: z.string().optional(),
  subtitulo: z.string().optional(),
  bullet1: z.string().optional(),
  bullet2: z.string().optional(),
  bullet3: z.string().optional(),
  bullet4: z.string().optional(),
  ctaLabel: z.string().optional(),
});

// Testimonios: sección repeater. Encabezado (eyebrow/titulo) + un ARRAY de ítems. Cada ítem SOFT:
// strings opcionales + `stars` número opcional. La validación de campos requeridos del ítem (name,
// text) es del EDITOR, no del schema — acá sólo se valida el TIPO (loader SOFT).
const testimonialItemSchema = z.object({
  name: z.string().optional(),
  city: z.string().optional(),
  text: z.string().optional(),
  product: z.string().optional(),
  stars: z.number().optional(),
});
const testimonialsEditableSchema = z.object({
  visible: z.boolean().optional(),
  eyebrow: z.string().optional(),
  titulo: z.string().optional(),
  items: z.array(testimonialItemSchema).optional(),
});

// /nosotros — la historia larga. Sólo texto (la galería es su propia sección, abajo).
const nosotrosHistoriaEditableSchema = z.object({
  visible: z.boolean().optional(),
  eyebrow: z.string().optional(),
  titulo: z.string().optional(),
  parrafo1: z.string().optional(),
  parrafo2: z.string().optional(),
  parrafo3: z.string().optional(),
});

// /nosotros — la galería (repeater con tipo imagen). Encabezado opcional + un ARRAY de ítems `{ url,
// alt }`, ambos strings opcionales (loader SOFT: la url la exige el editor, no el schema).
// `w`/`h` (proporción natural, capturada en la subida): DEBEN declararse o zod los descartaría al
// guardar y la galería perdería la proporción de cada celda. Opcionales/positivos.
const galeriaItemSchema = z.object({
  url: z.string().optional(),
  alt: z.string().optional(),
  w: z.number().positive().optional(),
  h: z.number().positive().optional(),
});
const nosotrosGaleriaEditableSchema = z.object({
  visible: z.boolean().optional(),
  eyebrow: z.string().optional(),
  titulo: z.string().optional(),
  items: z.array(galeriaItemSchema).optional(),
});

// META de páginas: `visible` por página. NO es una sección (no pasa por el flujo borrador/publicar
// de secciones); el toggle de encender/apagar /nosotros la escribe directo (tanda 1, commit 3).
const paginasEditableSchema = z.object({
  nosotros: z.object({ visible: z.boolean().optional() }).optional(),
});

export const siteContentEditableSchema = z.object({
  hero: heroEditableSchema.optional(),
  brandStory: brandStoryEditableSchema.optional(),
  subscriptionCTA: subscriptionCTAEditableSchema.optional(),
  testimonials: testimonialsEditableSchema.optional(),
  nosotrosHistoria: nosotrosHistoriaEditableSchema.optional(),
  nosotrosGaleria: nosotrosGaleriaEditableSchema.optional(),
  paginas: paginasEditableSchema.optional(),
});

export type SiteContentEditable = z.infer<typeof siteContentEditableSchema>;
