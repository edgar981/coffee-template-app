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

// Presentaciones: cardinalidad VARIABLE 2-4 con campos PLANOS (no repeater). Cada tarjeta: label +
// copy + imagen + CATEGORIA (el destino, § el destino de Presentaciones es DATO). TODOS los campos
// deben declararse o zod los STRIPPEA EN SILENCIO al guardar —era el bug #65-B: el schema quedó
// congelado en "exactamente 2 sin categoria" desde C1 mientras el modelo creció a 2-4 + destino-dato,
// así que `categoria1/2` y todo el slot 3-4 se perdían en cada ciclo—. Todo opcional/SOFT: el resolver
// aplica el default a los requeridos (1-2) y omite los opcionales (3-4). Imágenes string (path o Blob).
const presentacionesEditableSchema = z.object({
  visible: z.boolean().optional(),
  eyebrow: z.string().optional(),
  titulo: z.string().optional(),
  label1: z.string().optional(), copy1: z.string().optional(), imagen1: z.string().optional(), categoria1: z.string().optional(),
  label2: z.string().optional(), copy2: z.string().optional(), imagen2: z.string().optional(), categoria2: z.string().optional(),
  label3: z.string().optional(), copy3: z.string().optional(), imagen3: z.string().optional(), categoria3: z.string().optional(),
  label4: z.string().optional(), copy4: z.string().optional(), imagen4: z.string().optional(), categoria4: z.string().optional(),
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
// `w`/`h` (proporción), `tipo` (imagen|video) y `poster` (la imagen del vídeo): DEBEN declararse o zod
// los descartaría al guardar. `tipo` es un enum acotado; `poster` es una url (string). Todo opcional
// —`tipo` ausente = 'imagen', y un ítem-imagen no lleva `poster`—.
const galeriaItemSchema = z.object({
  url: z.string().optional(),
  alt: z.string().optional(),
  w: z.number().positive().optional(),
  h: z.number().positive().optional(),
  tipo: z.enum(['imagen', 'video']).optional(),
  poster: z.string().optional(),
});
const nosotrosGaleriaEditableSchema = z.object({
  visible: z.boolean().optional(),
  eyebrow: z.string().optional(),
  titulo: z.string().optional(),
  items: z.array(galeriaItemSchema).optional(),
});

// /suscripciones — los PLANES como dato (§ Backlog #49). Encabezado + "Elige tu plan" + `destacadoSlot`
// (índice del destacado, string) + 4 slots de plan, cada uno nombre/descripcion/precio + 4 beneficios.
// TODOS los campos deben declararse o zod los STRIPPEA al guardar (§ #65-B). Todo opcional/SOFT: el
// resolver aplica default (requerido) u omisión (opcional). El precio es string (texto, no número — la
// moneda/el formato son del cliente). El `site-content-schema.test.ts` verifica modelo ⊆ schema.
const suscripcionPlanesEditableSchema = z.object({
  visible: z.boolean().optional(),
  eyebrow: z.string().optional(),
  titulo: z.string().optional(),
  tituloEnfasis: z.string().optional(),
  subtitulo: z.string().optional(),
  planesTitulo: z.string().optional(),
  planesSubtitulo: z.string().optional(),
  ctaLabel: z.string().optional(),
  destacadoSlot: z.string().optional(),
  nombre1: z.string().optional(), descripcion1: z.string().optional(), precio1: z.string().optional(),
  ben1_1: z.string().optional(), ben1_2: z.string().optional(), ben1_3: z.string().optional(), ben1_4: z.string().optional(),
  nombre2: z.string().optional(), descripcion2: z.string().optional(), precio2: z.string().optional(),
  ben2_1: z.string().optional(), ben2_2: z.string().optional(), ben2_3: z.string().optional(), ben2_4: z.string().optional(),
  nombre3: z.string().optional(), descripcion3: z.string().optional(), precio3: z.string().optional(),
  ben3_1: z.string().optional(), ben3_2: z.string().optional(), ben3_3: z.string().optional(), ben3_4: z.string().optional(),
  nombre4: z.string().optional(), descripcion4: z.string().optional(), precio4: z.string().optional(),
  ben4_1: z.string().optional(), ben4_2: z.string().optional(), ben4_3: z.string().optional(), ben4_4: z.string().optional(),
});

// /suscripciones — los pasos "¿Cómo funciona?". Cardinalidad fija 4, sólo texto (íconos estructurales).
const suscripcionPasosEditableSchema = z.object({
  visible: z.boolean().optional(),
  titulo: z.string().optional(),
  paso1Label: z.string().optional(), paso1Desc: z.string().optional(),
  paso2Label: z.string().optional(), paso2Desc: z.string().optional(),
  paso3Label: z.string().optional(), paso3Desc: z.string().optional(),
  paso4Label: z.string().optional(), paso4Desc: z.string().optional(),
});

// META de páginas: `visible` por página. NO es una sección (no pasa por el flujo borrador/publicar
// de secciones); el toggle de encender/apagar /nosotros la escribe directo (tanda 1, commit 3).
const paginasEditableSchema = z.object({
  nosotros: z.object({ visible: z.boolean().optional() }).optional(),
});

export const siteContentEditableSchema = z.object({
  hero: heroEditableSchema.optional(),
  brandStory: brandStoryEditableSchema.optional(),
  presentaciones: presentacionesEditableSchema.optional(),
  subscriptionCTA: subscriptionCTAEditableSchema.optional(),
  testimonials: testimonialsEditableSchema.optional(),
  nosotrosHistoria: nosotrosHistoriaEditableSchema.optional(),
  nosotrosGaleria: nosotrosGaleriaEditableSchema.optional(),
  suscripcionPlanes: suscripcionPlanesEditableSchema.optional(),
  suscripcionPasos: suscripcionPasosEditableSchema.optional(),
  paginas: paginasEditableSchema.optional(),
});

export type SiteContentEditable = z.infer<typeof siteContentEditableSchema>;
