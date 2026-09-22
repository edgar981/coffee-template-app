import { z } from 'zod';
import { BANDA_IDS } from './site-content-defaults';

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
  // Path estático (`/images/…`) o URL de Blob — el modelo acepta ambos, así que sólo string. Con
  // `imagenTipo:'video'` esta URL es la del VIDEO, no de una imagen (§ HERO-VIDEO-COMO-DATO-1).
  imagen: z.string().optional(),
  // `variante` (§ eje 5, EJE-5-VARIANTES-HERO): la COMPOSICIÓN de la sección ('curtina'|'ficha');
  // `z.string()` porque el set de claves es por-sección y el resolver SOFT (`resolverVariante`) la
  // clampa a la canónica — gemela de `presentaciones.variante`.
  variante: z.string().optional(),
  // El TIPO de medio de fondo (§ HERO-VIDEO-COMO-DATO-1): 'imagen'|'video'. `z.string()` —no
  // `z.enum`—, MISMO motivo que `variante`: el resolver SOFT (`resolverVariante`, vía
  // `REGISTRY.hero.escalares`) ya clampa a la canónica; el schema sólo valida el TIPO.
  imagenTipo: z.string().optional(),
  // El PÓSTER del video: string (url de blob), como `imagen`. El `.refine()` de abajo lo exige NO
  // VACÍO cuando `imagenTipo === 'video'` — ver ese comentario para el porqué de esta única regla
  // DURA en un schema que es SOFT a propósito en todo lo demás.
  imagenPoster: z.string().optional(),
}).refine(
  // LA ÚNICA REGLA DURA de este schema (§ HERO-VIDEO-COMO-DATO-1, decisión del owner). NO exige que
  // `imagenPoster` ESTÉ —un hero de IMAGEN sigue pasando con todo vacío, como siempre—: exige que
  // DOS CAMPOS SEAN COHERENTES entre sí, y sólo cuando el dueño ELIGIÓ video. El motivo: el editor
  // es hoy el ÚNICO camino de escritura y garantiza el orden póster-antes-que-video por
  // construcción, pero esa garantía deja de alcanzar el día que exista OTRO camino —un import, una
  // corrección a mano, un runbook—, y ESE día el `.refine()` sigue protegiendo. Confiar en "el
  // editor siempre lo hace bien" es la misma apuesta que ya perdió el schema editable de
  // Presentaciones (§ #65-B): diez campos strippeados en silencio porque nadie los declaró aquí.
  (v) => v.imagenTipo !== 'video' || !!(v.imagenPoster && v.imagenPoster.trim() !== ''),
  { message: 'Un hero de video necesita un póster: sin él, la portada puede quedar sin nada que mostrar mientras el video carga.', path: ['imagenPoster'] },
);

// TrustBadges (§ CONTENIDO-CAFE-A-DATO-B-1, íconos extendidos en § CONTENIDO-CAFE-A-DATO-B-EXT-1):
// cuatro textos de cardinalidad FIJA + su ícono (`badgeNIcono`, un NOMBRE de un set cerrado —
// `components/storefront/badge-iconos.ts`—, NO un componente). Todo opcional/SOFT, como el resto:
// el resolver aplica el default NEUTRO (`''`) a lo que venga vacío; el CLAMP al set cerrado lo hace
// el RENDER (`iconoBadge`), no este schema — `z.string()` porque, igual que `variante`, es sólo el
// TIPO lo que se valida acá.
const trustBadgesEditableSchema = z.object({
  visible: z.boolean().optional(),
  badge1: z.string().optional(),
  badge1Icono: z.string().optional(),
  badge2: z.string().optional(),
  badge2Icono: z.string().optional(),
  badge3: z.string().optional(),
  badge3Icono: z.string().optional(),
  badge4: z.string().optional(),
  badge4Icono: z.string().optional(),
});

// Los badges de la FICHA de producto (§ CONTENIDO-CAFE-A-DATO-B-EXT-1). Gemela EXACTA de
// `trustBadgesEditableSchema`: TRES textos de cardinalidad FIJA + su ícono, mismo molde SOFT.
const productoBadgesEditableSchema = z.object({
  visible: z.boolean().optional(),
  badge1: z.string().optional(),
  badge1Icono: z.string().optional(),
  badge2: z.string().optional(),
  badge2Icono: z.string().optional(),
  badge3: z.string().optional(),
  badge3Icono: z.string().optional(),
});

// BrandStory: h2 en UN campo (`titulo`), dos párrafos, cuatro imágenes FIJAS. `visible` porque
// es la primera sección ocultable. Todo opcional/SOFT, como el hero: el resolver decide.
// `variante` (§ eje 5e, TEMAS-P2-BRANDSTORY-1): la COMPOSICIÓN de la sección ('columnas', hoy la
// única clave); `z.string()` porque el set de claves es por-sección y el resolver SOFT
// (`resolverVariante`) la clampa a la canónica — gemela de `hero.variante`/`presentaciones.variante`.
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
  variante: z.string().optional(),
});

// Presentaciones: cardinalidad VARIABLE 2-4 con campos PLANOS (no repeater). Cada tarjeta: label +
// copy + imagen + CATEGORIA (el destino, § el destino de Presentaciones es DATO). TODOS los campos
// deben declararse o zod los STRIPPEA EN SILENCIO al guardar —era el bug #65-B: el schema quedó
// congelado en "exactamente 2 sin categoria" desde C1 mientras el modelo creció a 2-4 + destino-dato,
// así que `categoria1/2` y todo el slot 3-4 se perdían en cada ciclo—. Todo opcional/SOFT: el resolver
// aplica el default a los requeridos (1-2) y omite los opcionales (3-4). Imágenes string (path o Blob).
// `variante` (§ eje 5e): la COMPOSICIÓN de la sección ('mosaico'|'indice'); `z.string()` porque el
// set de claves es por-sección y el resolver SOFT (`resolverVariante`) la clampa a la canónica.
const presentacionesEditableSchema = z.object({
  visible: z.boolean().optional(),
  eyebrow: z.string().optional(),
  titulo: z.string().optional(),
  label1: z.string().optional(), copy1: z.string().optional(), imagen1: z.string().optional(), categoria1: z.string().optional(),
  label2: z.string().optional(), copy2: z.string().optional(), imagen2: z.string().optional(), categoria2: z.string().optional(),
  label3: z.string().optional(), copy3: z.string().optional(), imagen3: z.string().optional(), categoria3: z.string().optional(),
  label4: z.string().optional(), copy4: z.string().optional(), imagen4: z.string().optional(), categoria4: z.string().optional(),
  variante: z.string().optional(),
});

// SubscriptionCTA: solo texto (sin imágenes). `bullet1..4` opcionales — el resolver los omite
// vacíos y el componente los junta con `.filter` (hasta 4, sin hueco). `ctaLabel` editable; el href
// es estructura. Todo opcional/SOFT, como los otros.
// `variante` (TEMAS-SUBSCRIPTIONCTA-LINEA-1, § eje 5e): la COMPOSICIÓN de la sección
// ('bloque'|'linea'); `z.string()` porque el set de claves es por-sección y el resolver SOFT
// (`resolverVariante`) la clampa a la canónica — gemela de `hero.variante`/`presentaciones.variante`.
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
  variante: z.string().optional(),
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

// /suscripciones — la FAQ (§ SUSCRIPCIONES-FAQ-DATO-1). Sección repeater: encabezado (`titulo`) + un
// ARRAY de ítems `{ question, answer }`. Cada ítem SOFT: strings opcionales — la validación de
// requeridos (question, answer) es del EDITOR, no del schema (loader SOFT), como testimonios.
const suscripcionFaqItemSchema = z.object({
  question: z.string().optional(),
  answer: z.string().optional(),
});
const suscripcionFaqEditableSchema = z.object({
  visible: z.boolean().optional(),
  titulo: z.string().optional(),
  items: z.array(suscripcionFaqItemSchema).optional(),
});

// META de páginas: `visible` por página. NO es una sección (no pasa por el flujo borrador/publicar
// de secciones); el toggle de encender/apagar /nosotros la escribe directo (tanda 1, commit 3).
const paginasEditableSchema = z.object({
  nosotros: z.object({ visible: z.boolean().optional() }).optional(),
});

// META de MICROCOPY (§ CONTENIDO-CAFE-A-DATO-B-1): las frases de chrome (buscador del nav, /tienda,
// el vacío del carrito, /rastrear-pedido). NO es una sección —tampoco pasa por el flujo borrador/
// publicar—; se declara acá SÓLO para que un futuro write general no la STRIPPEE en silencio
// (§ #65-B), igual que `esquemas`/`orden`/`variantesBandas` — HOY no hay editor que la escriba (la
// puebla el sembrado, `prisma/sembrar-copy-nayoli.ts`, directo sobre la fila).
const microcopyEditableSchema = z.object({
  navBuscarPlaceholder: z.string().optional(),
  tiendaSubtitulo: z.string().optional(),
  tiendaBuscarPlaceholder: z.string().optional(),
  carritoVacioTexto: z.string().optional(),
  rastreoPagadoDesc: z.string().optional(),
  rastreoEntregadoDesc: z.string().optional(),
});

// META de esquemas (§ eje 5b, mitad B): el mapa banda→esquema. NO es una sección —tampoco pasa por
// el flujo borrador/publicar—; se declara acá SÓLO para que un futuro write general no la STRIPPEE
// en silencio (§ #65-B). HOY no hay editor que la escriba (SIN PICKER, decisión del owner): se
// compone en el onboarding, directo en la fila. `z.record` acepta cualquier bandaId (key-agnóstico,
// como `resolverEsquemas`); el VALOR sí se acota al set cerrado de 4 —a diferencia del resolver
// (que absorbe basura SOFT para no romper una lectura ya guardada), el WRITE puede rechazarla.
const esquemasEditableSchema = z.record(z.string(), z.enum(['crema', 'superficie', 'oscuro', 'acento']));

// META de ORDEN (§ eje 5, parte c — el orden de las bandas del home como dato). NO es una sección
// —tampoco pasa por el flujo borrador/publicar—; se declara acá SÓLO para que un futuro write
// general no la STRIPPEE en silencio (§ #65-B). El set cerrado (`BANDA_IDS`) es la MISMA lista que
// `resolverOrden` usa para filtrar — importada, no una segunda declaración. El LOADER
// (`resolverOrden`) es la última red SOFT: aunque el schema deje pasar un array raro (o ninguno),
// el resolver filtra a ids conocidos, deduplica y completa lo faltante. Acá el WRITE puede ser más
// estricto que el loader (como `esquemasEditableSchema`): un id fuera del set cerrado, o repetido,
// se rechaza.
const ordenEditableSchema = z.array(z.enum(BANDA_IDS)).refine(
  (arr) => new Set(arr).size === arr.length,
  { message: 'orden: una banda no puede repetirse' },
);

// META de VARIANTES DE BANDAS ESTRUCTURALES (TEMAS-P1-FEATURED-VARIANTES-1): el mapa bandaId→variante
// para bandas SIN sección (`featured`, hoy la única — § `VARIANTES_ESTRUCTURALES`,
// site-content-defaults.ts). Gemela de `esquemasEditableSchema`: NO es una sección —tampoco pasa por
// el flujo borrador/publicar—; se declara acá SÓLO para que un futuro write general no la STRIPPEE en
// silencio (§ #65-B). HOY no hay editor que la escriba —la escribe `aplicarPreset` (§ themes.ts),
// directo sobre el `content` publicado, como `esquemas`/`orden`—. `z.record` acepta cualquier
// bandaId (key-agnóstico, como `resolverVariantesBandas`); el VALOR es `z.string()` sin acotar al set
// cerrado por-banda —igual que `hero.variante`/`brandStory.variante`/`presentaciones.variante`
// arriba—, porque ese set es POR-BANDA (`VARIANTES_ESTRUCTURALES[banda].claves`) y el loader SOFT
// (`resolverVariantesBandas`) ya es la red que descarta lo que no encaje.
const variantesBandasEditableSchema = z.record(z.string(), z.string());

export const siteContentEditableSchema = z.object({
  hero: heroEditableSchema.optional(),
  trustBadges: trustBadgesEditableSchema.optional(),
  productoBadges: productoBadgesEditableSchema.optional(),
  brandStory: brandStoryEditableSchema.optional(),
  presentaciones: presentacionesEditableSchema.optional(),
  subscriptionCTA: subscriptionCTAEditableSchema.optional(),
  testimonials: testimonialsEditableSchema.optional(),
  nosotrosHistoria: nosotrosHistoriaEditableSchema.optional(),
  nosotrosGaleria: nosotrosGaleriaEditableSchema.optional(),
  suscripcionPlanes: suscripcionPlanesEditableSchema.optional(),
  suscripcionPasos: suscripcionPasosEditableSchema.optional(),
  suscripcionFaq: suscripcionFaqEditableSchema.optional(),
  paginas: paginasEditableSchema.optional(),
  microcopy: microcopyEditableSchema.optional(),
  esquemas: esquemasEditableSchema.optional(),
  orden: ordenEditableSchema.optional(),
  variantesBandas: variantesBandasEditableSchema.optional(),
});

export type SiteContentEditable = z.infer<typeof siteContentEditableSchema>;
