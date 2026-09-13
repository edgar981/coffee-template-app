// DEFAULTS + REGISTRY + resolver del CONTENIDO del storefront. Módulo PURO —sin prisma,
// sin server-only— para que capa 1 lo pruebe y para que el carril/route handlers lo usen.
//
// LOADER SOFT (lo opuesto a SiteSetting): el vacío es un estado LEGÍTIMO del editor, no un
// error. Nada falla ruidoso; un campo vacío cae al default (requerido) o se omite (opcional).
// Sin fila en la base, gobiernan estos defaults — por eso SiteContent no siembra fila en su
// migración.

import { resolverFuentePar, type ClaveFuentePar } from './fuentes';
import { resolverForma, type ClaveForma } from './formas';
import type { EsquemaId } from './palette-derive';

// Alias con el vocabulario de esta capa (§ eje 5b, mitad B — el EFECTO en el home). Es EL MISMO
// tipo que `EsquemaId` de `palette-derive.ts` (el MOTOR ya lo declaró): 'crema' | 'superficie' |
// 'oscuro' | 'acento'. No se redeclara — un segundo set cerrado es cómo diverge del que el motor
// realmente deriva.
export type ClaveEsquema = EsquemaId;

export interface HeroContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  tituloEnfasis: string;
  subtitulo: string;
  ctaPrimarioLabel: string;
  ctaSecundarioLabel: string;
  imagen: string;
  // La VARIANTE de composición (§ eje 5, EJE-5-VARIANTES-HERO). 'curtina' (canónica, la de Nayoli) |
  // 'ficha'. Escalar de SECCIÓN —como `visible`—, no un `campos`: no lo toca el loop
  // requerido/opcional del resolver. Gemela de `presentaciones.variante` (§ eje 5e).
  variante: string;
}

// BrandStory ("Nuestra Historia"): eyebrow + h2 + dos párrafos + un collage 2×2 de cuatro
// imágenes FIJAS (mismo tamaño, el offset lo da la POSICIÓN, no el contenido). El h2 es UN
// campo —el salto de línea es estético, no énfasis— así que NO lleva el `tituloEnfasis` del
// hero. `eyebrow` y `parrafo2` son opcionales (se omiten vacíos); las cuatro imágenes son
// requeridas (el collage 2×2 es rígido: menos de cuatro deja hueco, § doctrina).
export interface BrandStoryContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  parrafo1: string;
  parrafo2: string;
  imagen1: string;
  imagen2: string;
  imagen3: string;
  imagen4: string;
  // La VARIANTE de composición (§ eje 5e, TEMAS-P2-BRANDSTORY-1). 'columnas' es la ÚNICA clave hoy
  // —y la canónica—: abre el slot para la PLATAFORMA de themes (tres de los cinco themes del programa
  // la necesitan) sin construir ninguna forma alternativa todavía. Escalar de SECCIÓN —como
  // `visible`—, no un `campos`: no lo toca el loop requerido/opcional del resolver. Gemela de
  // `hero.variante`/`presentaciones.variante`.
  variante: string;
}

// Presentaciones ("¿Cómo tomas tu café?"): de 2 a 4 tarjetas de presentación. Cardinalidad VARIABLE
// pero con campos PLANOS, NO un repeater —un repeater no puede dar defaults byte-idénticos
// (`resolverItems` → `[]` sin fila, invariante #44)—. La variable se expresa como **2 slots REQUERIDOS
// (siempre, con los defaults de Nayoli) + 2 OPCIONALES (defaults vacíos)**: mínimo 2, máximo 4. Cada
// tarjeta: label + copy + imagen + `categoria` (el DESTINO, § el destino de Presentaciones es DATO).
// El href lo construye `hrefCategoria(categoria)`. Qué tarjeta SE MUESTRA lo decide el componente
// (`tarjetasDePresentaciones`, título O imagen), NO el resolver — así 2→4 no toca ni el resolver ni #44.
export interface PresentacionesContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  // Tarjetas 1-2 REQUERIDAS (siempre renderizan → mínimo 2, con los defaults de Nayoli).
  label1: string;
  copy1: string;
  imagen1: string;
  categoria1: string;
  label2: string;
  copy2: string;
  imagen2: string;
  categoria2: string;
  // Tarjetas 3-4 OPCIONALES (defaults VACÍOS): la tarjeta se muestra si tiene título O imagen
  // (§ tarjetasDePresentaciones). Es lo que sube la cardinalidad de FIJA-2 a VARIABLE 2-4 sin tocar
  // el resolver ni #44 — son campos opcionales más, y el filtrado por-tarjeta vive en el componente.
  label3: string;
  copy3: string;
  imagen3: string;
  categoria3: string;
  label4: string;
  copy4: string;
  imagen4: string;
  categoria4: string;
  // La VARIANTE de composición (§ eje 5e). 'mosaico' (canónica, la de Nayoli) | 'indice'. Escalar de
  // SECCIÓN —como `visible`—, no un `campos`: no lo toca el loop requerido/opcional del resolver.
  variante: string;
}

// SubscriptionCTA ("Plan Suscripción"): eyebrow + h2 + un párrafo + HASTA CUATRO bullets + el label
// del CTA (su href es ESTRUCTURA, `/suscripciones`, no editable). Sección de SOLO TEXTO —sin
// imágenes—. Los bullets son `bullet1..4` OPCIONALES: el componente los junta con un `.filter` que
// SALTA los vacíos, así que "vaciar el 2 y dejar el 3" cierra la lista sin hueco — son "hasta cuatro
// bullets", no "cuatro slots" (el editor lo dice en las etiquetas). 5+ bullets = el repeater
// compartido (la plataforma ya lo tiene). Las tarjetas de plan del teaser NO viven acá: son la sección
// `suscripcionPlanes` (DATO editable, § Backlog #49), la MISMA que lee /suscripciones — este teaser las
// recorta con `planesDelTeaser` (§ lib/storefront/planes-suscripcion).
export interface SubscriptionCTAContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  subtitulo: string;
  bullet1: string;
  bullet2: string;
  bullet3: string;
  bullet4: string;
  ctaLabel: string;
}

// Testimonios ("Lo que dicen nuestros clientes"): la PRIMERA sección REPEATER — un encabezado de
// sección (eyebrow + titulo) sobre una LISTA de testimonios. Cada ítem: name/text requeridos,
// city/product opcionales, y `stars` (número, no string → el resolver lo pasa tal cual). Es
// OCULTABLE **y** hide-on-empty: con `items` vacío no se renderiza, y esa precedencia gana sobre el
// toggle. NACE CON items VACÍOS a propósito (§ SiteContent — el repeater): los defaults valen para copy,
// NO para un CLAIM falso — los tres testimonios fabricados no van a defaults; el owner carga los
// reales como DATO por el editor.
export interface TestimonialItem {
  name: string;
  city: string;
  text: string;
  product: string;
  stars: number;
}

export interface TestimonialsContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  items: TestimonialItem[];
}

// LA PÁGINA /nosotros — el relato largo (la home lleva el ANZUELO: el collage de 4 fotos fijas de
// brandStory; la historia completa vive acá). Es una sección MÁS del mismo `content` JSON —la
// "página" es una agrupación de CONFIG (§ tienda-secciones `pagina`), no un anidado en el dato—.
// `ocultable:false` porque el ocultar es a nivel de PÁGINA (`paginas.nosotros.visible`), no de esta
// sección.
export interface NosotrosHistoriaContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  parrafo1: string;
  parrafo2: string;
  parrafo3: string;
}

// La GALERÍA de /nosotros: la SEGUNDA sección REPEATER (Testimonios fue la primera), y la que
// estrena el tipo `imagen` por ítem. Un encabezado OPCIONAL (eyebrow + titulo) sobre una LISTA de
// fotos. Cada ítem: `url` requerida (la foto), `alt` opcional (la descripción para lectores de
// pantalla). Es OCULTABLE **y** hide-on-empty: sin fotos no se renderiza. NACE VACÍA (§ el repeater):
// las fotos de la finca las sube el owner como DATO, no hay defaults de imagen que fabricar.
// A DIFERENCIA de Testimonios, el `titulo` es OPCIONAL: una galería puede ir sin encabezado (las
// fotos son el contenido), así que vaciarlo lo omite en vez de caer al default.
// `w`/`h` son la proporción NATURAL de la foto/vídeo, capturada en la subida (§ useSubidaImagen; de
// `createImageBitmap` para imagen, de `loadedmetadata` para vídeo), para que la galería reserve el
// alto de cada celda sin salto de layout (masonry). Opcionales: un ítem viejo o uno que el navegador
// no pudo medir cae a una proporción por defecto.
//
// `tipo` es un HECHO DECLARADO (no se deduce de la extensión — un vídeo trae DOS urls de distinto
// tipo, el vídeo y el póster; y la doctrina prefiere un dato a un string parseado, § agotado).
// AUSENTE = 'imagen' (los ítems previos no lo tienen; retrocompatible). `poster` es la imagen que se
// ve mientras el vídeo carga / antes de reproducir — REQUERIDA para un vídeo, y el alta lo garantiza
// por construcción (el ítem-vídeo nace con vídeo Y póster; § el editor). Los cuatro pasan TAL CUAL por
// el resolver (no son campos string declarados del repeater), como el `stars` de un testimonio.
export interface GaleriaItem {
  url: string;
  alt: string;
  w?: number;
  h?: number;
  tipo?: 'imagen' | 'video';
  poster?: string;
}

export interface NosotrosGaleriaContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  items: GaleriaItem[];
}

// LA PÁGINA /suscripciones — los PLANES como DATO (§ Backlog #49, opción 1). Antes las tarjetas de
// plan venían de `SUBSCRIPTION_PLANS` (`lib/mock/subscriptions`, ESTRUCTURA compartida con la home);
// ahora son contenido editable, y las DOS superficies (esta página Y el teaser de la home) leen esta
// MISMA sección → no divergen (era el temor de #49; hacerlas dato lo RESUELVE, no lo causa).
//
// CARDINALIDAD 1-4 con CAMPOS PLANOS (no repeater — un repeater no da defaults byte-idénticos, § la
// bifurcación de cardinalidad). Plan 1 REQUERIDO (empty → default de Nayoli → mínimo 1); planes 2-4
// OPCIONALES (empty → el plan no se muestra). Qué plan SE MUESTRA lo decide el componente
// (`planesDeSuscripcion`, nombre presente), NO el resolver — como Presentaciones.
//
// El PRECIO es OPCIONAL y de TEXTO (owner): un plan puede llevarlo o no; la moneda, el formato y frases
// como "desde $X" son del cliente, y un número inventado sería dato FALSO en la ruta del dinero. Vacío
// → NO se muestra (nunca placeholder ni "desde"). Nayoli no lleva precio → sus `precioN` nacen vacíos.
//
// La FRECUENCIA vive DENTRO de `descripcion` ("El doble del plan básico, cada mes"), como frase
// (owner, § b): el sistema no la usa como dato —no hay pedidos recurrentes— así que un campo aparte
// sería una mina inerte. Los BENEFICIOS por plan son `benN_1..4` OPCIONALES (el componente los junta
// con `.filter`, hasta 4 sin hueco — como los bullets de subscriptionCTA). El DESTAQUE es UN índice de
// sección (`destacadoSlot`, § c): unifica el `plan.popular` de esta página y el `i===1` hardcodeado del
// teaser —estructuralmente imposible destacar dos—. '' = ninguno; default '2' (el Plan Estándar de hoy).
//
// LOS NOMBRES NO LLEVAN UNIDAD (§ CONTENIDO-NEUTRALIZAR-3): 'Plan 250 g'/'Plan 500 g' presuponían
// gramos, o sea la mercadería — un cliente de cualquier otro rubro los vería tal cual. Lo que un plan
// distingue en CUALQUIER rubro es CUÁNTO (relativo al plan anterior) y CADA CUÁNTO, sin nombrar el
// producto ni asumir peso/volumen: 'Plan Básico' → 'Plan Estándar' (el doble) → 'Plan Familiar' (el
// doble del anterior). 'Plan Familiar' ya era genérico y no cambió.
export interface SuscripcionPlanesContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  tituloEnfasis: string;
  subtitulo: string;
  planesTitulo: string;
  planesSubtitulo: string;
  ctaLabel: string;
  /** El SLOT del plan destacado ('1'..'4'), o '' (ninguno). Un índice, no un booleano por plan:
   *  imposible destacar dos. Lo consumen las DOS superficies (esta página + el teaser). */
  destacadoSlot: string;
  // Plan 1 REQUERIDO (defaults de Nayoli). `precio` y los beneficios OPCIONALES.
  nombre1: string; descripcion1: string; precio1: string;
  ben1_1: string; ben1_2: string; ben1_3: string; ben1_4: string;
  // Planes 2-4 OPCIONALES: nombre vacío → el plan no se muestra (§ planesDeSuscripcion).
  nombre2: string; descripcion2: string; precio2: string;
  ben2_1: string; ben2_2: string; ben2_3: string; ben2_4: string;
  nombre3: string; descripcion3: string; precio3: string;
  ben3_1: string; ben3_2: string; ben3_3: string; ben3_4: string;
  nombre4: string; descripcion4: string; precio4: string;
  ben4_1: string; ben4_2: string; ben4_3: string; ben4_4: string;
}

// Los PASOS "¿Cómo funciona?" de /suscripciones (§ Backlog #49 · e). Café-shape en el TEXTO ("café de
// nuestra finca", "grano o molido", "tandas semanales") → entran como DATO editable. Cardinalidad FIJA
// 4 (una historia de 4 pasos; variar el número es otra decisión) → campos PLANOS requeridos, byte-
// idénticos a los `SUBSCRIPTION_STEPS` de hoy. Los ÍCONOS y el número "01".."04" quedan ESTRUCTURALES
// (secuencia, no contenido): el componente los pone por índice; un selector de íconos es capacidad
// mayor, no un campo. Sección OCULTABLE (un cliente puede no querer un "cómo funciona").
export interface SuscripcionPasosContent {
  visible: boolean;
  titulo: string;
  paso1Label: string; paso1Desc: string;
  paso2Label: string; paso2Desc: string;
  paso3Label: string; paso3Desc: string;
  paso4Label: string; paso4Desc: string;
}

// La FAQ de /suscripciones (§ SUSCRIPCIONES-FAQ-DATO-1, sobre § Backlog #49 y § SiteContent — el
// repeater). Antes vivía en `constants/subscription-faq.ts` (RETIRADO): cuatro preguntas con
// respuestas FALSAS —"pausar… desde tu cuenta" (la ruta `/cuenta` está borrada), "el cobro se
// realiza el mismo día de cada mes" y "el cambio aplica desde el siguiente ciclo" (no hay cobro
// recurrente: `esSuscripcion`/`SUBSCRIPTIONS_ENABLED` dan CERO en el repo, § #68), y "envío gratis a
// nivel nacional" (`computeShippingCost` cobra envío bajo `freeShippingThreshold` y no conoce el
// concepto de suscripción)—. Es el mismo caso que TESTIMONIOS (§ #44): los defaults valen para copy,
// NO para un CLAIM falso sobre el negocio, así que NACE VACÍA — REPEATER, hide-on-empty, sin copiar
// ninguna de las cuatro respuestas viejas.
export interface SuscripcionFaqItem {
  question: string;
  answer: string;
}

export interface SuscripcionFaqContent {
  visible: boolean;
  titulo: string;
  items: SuscripcionFaqItem[];
}

// META de páginas: qué páginas del storefront están ENCENDIDAS. NO es una sección (no lleva `campos`
// ni la resuelve el loop de secciones); es una capacidad —una página existe y se puede apagar—. Hoy
// /nosotros y /suscripciones son CAPACIDADES apagables (la home no se apaga). `suscripciones`
// gatea la página + el link del nav + la entrada del footer + el CTA de la home (§ Backlog #49):
// una suscripción hoy es sólo un mensaje de WhatsApp, así que apagarla es config, no un modelo.
export interface PaginasContent {
  nosotros: { visible: boolean };
  suscripciones: { visible: boolean };
}

// META de TEMA: las 3 RAÍCES de paleta del storefront (fondo·tinta·acento). NO es una sección (no
// lleva `campos` ni la resuelve el loop de secciones); es la PIEL de TODO el storefront, ortogonal a
// las páginas —por eso vive como clave no-sección, gemela de `paginas`, y su editor va SOBRE el
// selector de página, no dentro—. `null` en una raíz = el storefront cae a los defaults de código
// (§ cssPaleta / palette-derive), que SON la paleta de Nayoli. El motor deriva las demás tintas de
// estas tres; acá sólo se guardan las raíces. (Se mudó de SiteSetting —modelo HARD, guardar=publicar
// al instante— a acá para ganar el flujo borrador/publicar; § doctrina, la frontera es de PANTALLA.)
export interface TemaContent {
  fondo: string | null;
  tinta: string | null;
  acento: string | null;
  // El PAR TIPOGRÁFICO del storefront (§ Tanda C2 · #3, `lib/config/fuentes`). `null` = Editorial (el
  // default: Inter/Playfair, las de hoy) — como las raíces en null = fábrica. Un valor CUSTOM
  // ('calido'|'moderno'|'clasico'|'nitido') hace que el layout inyecte cssFuentes + el `<link>` del par.
  fuentePar: ClaveFuentePar | null;
  // La PERSONALIDAD DE FORMA del storefront (§ eje 4, `lib/config/formas`). `null` = Suave (el default:
  // los radios de hoy, 1.5/1/0.75rem) — como `fuentePar` en null = Editorial. Un valor CUSTOM
  // ('recta'|'minima') hace que el layout inyecte cssForma (§ forma-style).
  forma: ClaveForma | null;
}

export interface SiteContentData {
  hero: HeroContent;
  brandStory: BrandStoryContent;
  presentaciones: PresentacionesContent;
  subscriptionCTA: SubscriptionCTAContent;
  testimonials: TestimonialsContent;
  nosotrosHistoria: NosotrosHistoriaContent;
  nosotrosGaleria: NosotrosGaleriaContent;
  suscripcionPlanes: SuscripcionPlanesContent;
  suscripcionPasos: SuscripcionPasosContent;
  suscripcionFaq: SuscripcionFaqContent;
  paginas: PaginasContent;
  tema: TemaContent;
  esquemas: EsquemasContent;
  orden: OrdenContent;
}

// META de esquemas (§ eje 5b, mitad B): el mapa bandaId→esquema que decide sobre QUÉ superficie
// vive cada banda del home (§ palette-derive, `derivarEsquema`). NO es una sección (no lleva
// `campos` ni la resuelve el loop) — es la PIEL POR-BANDA, gemela de `tema` (que es la piel de
// TODO el storefront) pero con un dominio de claves ABIERTO: cualquier bandaId puede tener una
// entrada, así que no hay un `defaults` fijo que enumerar (§ `resolverEsquemas`, key-agnóstico).
// Una banda AUSENTE del mapa (o con basura) = SIN OVERRIDE = su token CANÓNICO de hoy — el
// mecanismo que mantiene a Nayoli byte-idéntica sin sembrar fila (§ `--sf-banda` en `esquema-style`).
export type EsquemasContent = Record<string, ClaveEsquema>;

// META de ORDEN (§ eje 5, parte c — el orden de las bandas del home como DATO). A diferencia de
// `esquemas` (dominio ABIERTO, cualquier bandaId), acá el dominio es CERRADO: los 7 ids de banda
// que hoy monta `app/(storefront)/page.tsx`. `BANDA_IDS` es la ÚNICA lista de esos ids —
// `site-content-schema.ts` la importa para su `z.enum` en vez de declarar una segunda—, y ya está
// en el ORDEN DEFAULT de hoy, así que `[...BANDA_IDS]` sirve directo como default. Newsletter
// (`newsletter`) queda FUERA: sigue oculta/comentada en v1 (§ page.tsx) y no se renderiza, así que
// no es un id reordenable — agregarla es el día que se reactive esa sección.
export const BANDA_IDS = [
  'hero', 'trustBadges', 'featured', 'brandStory', 'presentaciones', 'subscriptionCTA', 'testimonials',
] as const;
export type BandaId = typeof BANDA_IDS[number];
export type OrdenContent = BandaId[];
export const ORDEN_DEFAULT: BandaId[] = [...BANDA_IDS];

// LA CANÓNICA DE DARKNESS POR BANDA (§ eje 5, cierra la mina del nav abierta por el orden-como-dato).
// `bandaEsOscura` (`lib/config/esquema-style.ts`, consumida por `tratamientoNav` → StoreNav) necesita
// saber si la banda sobre la que flota el nav es oscura CUANDO esa banda NO tiene esquema asignado. Antes de
// este set no existía tal cosa: la función (entonces `heroEsOscuro`) asumía SIEMPRE la canónica del
// HERO —correcto sólo mientras `orden[0]` era necesariamente 'hero'—; el eje 5 (el orden como dato)
// rompió esa garantía, así que una banda CLARA sin esquema puesta primera habría dejado el nav con
// texto claro sobre fondo claro.
//
// El DEFAULT es CLARO: oscuro es la EXCEPCIÓN declarada acá, no la regla. Atado a los fondos
// canónicos que cada componente del home trae como fallback de `bg-[var(--sf-banda,<token>)]`
// (grep vivo contra el código, no supuesto — verificar de nuevo si un componente cambia su fallback):
//   hero            → var(--sf-tinta)      (HeroCurtina.tsx, variante 'curtina') → OSCURA
//                     var(--sf-fondo)      (HeroFicha.tsx, variante 'ficha')     → clara
//   brandStory      → var(--sf-tinta)      (BrandStory.tsx)         → OSCURA
//   subscriptionCTA → var(--sf-tinta-2)    (SubscriptionCTA.tsx)    → OSCURA
//   trustBadges     → var(--sf-fondo)      (TrustBadges.tsx)        → clara
//   featured        → var(--sf-fondo)      (FeaturedProducts.tsx)   → clara
//   presentaciones  → var(--sf-fondo)      (GrindChooser.tsx)       → clara
//   testimonials    → var(--sf-fondo)      (TestimonialSection.tsx) → clara
//   (newsletter     → var(--sf-superficie) (Newsletter.tsx), oculta v1 — no en BANDA_IDS, no aplica)
//
// Esta lista DUPLICA a propósito el token que cada componente ya declara en su JSX — no se
// refactorizaron los fondos canónicos a un dato compartido en esta pasada (alcance mayor al de este
// slice, a decidir aparte). Si un componente cambia su fallback de `--sf-banda`, este set hay que
// actualizarlo A MANO contra el grep de arriba, o divergen en silencio.
//
// EL HERO ES LA ÚNICA BANDA CUYA CANÓNICA DEPENDE DE SU VARIANTE (§ EJE-5-VARIANTES-HERO): este
// `Set` sólo puede decir "oscura o clara", no "depende de X" — por eso el hero SIGUE apareciendo acá
// (oscura, la de la variante 'curtina', la canónica de Nayoli) pero `bandaOscuraCanonica` (abajo) es
// el punto de entrada real para cualquier consumidor, porque es la única función que sabe bifurcar
// por variante. Las demás bandas de este set no varían con su variante hoy (ninguna otra sección
// declara `variantes` que cambie su fondo canónico) y siguen resolviendo por `BANDAS_OSCURAS` a secas.
export const BANDAS_OSCURAS: ReadonlySet<BandaId> = new Set<BandaId>(['hero', 'brandStory', 'subscriptionCTA']);

/** La darkness CANÓNICA (sin esquema) de una banda, dependiente de su VARIANTE cuando la
 *  tiene. Hoy sólo el HERO: 'curtina' es OSCURA (fondo `--sf-tinta`), 'ficha' es CLARA (fondo
 *  `--sf-fondo`) — atado al fallback `bg-[var(--sf-banda,<token>)]` de cada componente, como
 *  `BANDAS_OSCURAS`. El resto de las bandas no varían con la variante → `BANDAS_OSCURAS`. */
export function bandaOscuraCanonica(bandaId: BandaId, variante?: string): boolean {
  if (bandaId === 'hero') return variante !== 'ficha'; // curtina/ausente = oscura; ficha = clara
  return BANDAS_OSCURAS.has(bandaId);
}

/** ¿La banda `bandaId` en su `variante` es UNIFORME (un solo tono, § EJE-5-NAV-UNIFORME)? El nav
 *  transparente-flotante sólo puede posarse sobre una banda uniforme —una banda partida (bi-tonal)
 *  no tiene un color de texto único que se lea sobre las dos mitades—. La fuente es la VARIANTE
 *  (`VariantesDef.noUniformes`), no un esquema: un esquema no parte ni une una banda, así que la
 *  uniformidad es puro LAYOUT sin otra fuente con la que discrepar (a diferencia de la darkness,
 *  que SÍ tiene fuente dinámica —el esquema— y por eso se computa en `bandaEsOscura`, nunca se
 *  declara). Lookup SEGURO: `bandaId` puede no ser una `SeccionKey` (trustBadges/featured son
 *  bandas ESTRUCTURALES, sin sección en `SiteContentData`) — sin `variantes` declaradas, uniforme
 *  por default. */
export function bandaUniforme(bandaId: BandaId, variante?: string): boolean {
  const def = (REGISTRY as Record<string, SeccionDef | undefined>)[bandaId];
  const nu = def?.variantes?.noUniformes;
  return !(nu && variante !== undefined && nu.includes(variante));
}

/** La variante resuelta de una banda, o undefined si la banda no es una sección con variante
 *  (p.ej. trustBadges/featured son bandas ESTRUCTURALES, sin sección en SiteContentData). */
export function varianteDeBanda(content: SiteContentData, bandaId: BandaId): string | undefined {
  const sec = (content as unknown as Record<string, unknown>)[bandaId];
  return sec && typeof sec === 'object' && 'variante' in sec
    ? (sec as { variante?: string }).variante : undefined;
}

// Los DEFAULTS son los literales que hoy viven en el JSX del hero. Se mueven acá; el
// componente los recibe resueltos.
export const DEFAULTS: SiteContentData = {
  hero: {
    visible: true,
    eyebrow: 'Calidad en cada pedido',
    titulo: 'Productos que cuentan',
    tituloEnfasis: 'historias',
    subtitulo:
      'Cuidamos cada pedido de principio a fin: eliges lo que necesitas, te confirmamos enseguida, y lo recibes tal como lo esperabas.',
    ctaPrimarioLabel: 'Ver Catálogo',
    ctaSecundarioLabel: 'Suscripción Mensual',
    imagen: '/images/hero-cerezas-v1.jpg',
    // La canónica (§ eje 5, EJE-5-VARIANTES-HERO): Nayoli queda byte-idéntica a la curtina de hoy.
    variante: 'curtina',
  },
  brandStory: {
    visible: true,
    eyebrow: 'Nuestra Historia',
    titulo: 'Detrás de cada pedido',
    parrafo1:
      'Empezamos con una idea simple: que comprar algo bueno no debería ser complicado. Por eso cuidamos cada pedido como si fuera el único, desde que lo eliges hasta que lo recibes.',
    parrafo2:
      'Seguimos aquí gracias a quienes vuelven a pedir, y eso es lo que más nos importa cuidar: que la próxima vez sea tan buena como la primera.',
    imagen1: '/images/historia-1-v1.jpg',
    imagen2: '/images/historia-2-v1.jpg',
    imagen3: '/images/historia-3-v1.jpg',
    imagen4: '/images/historia-4-v1.jpg',
    // La canónica (§ eje 5e, TEMAS-P2-BRANDSTORY-1): Nayoli queda byte-idéntica al collage de hoy.
    variante: 'columnas',
  },
  // Los literales que hoy viven en GrindChooser (OPCIONES + el encabezado). Byte a byte: sin fila de
  // SiteContent, la home queda IDÉNTICA (§ el test de byte-idéntico). Las imágenes son paths /public
  // (como el hero) — override por Blob, next/image sirve ambos, `storage.delete` es no-op sobre estáticos.
  presentaciones: {
    visible: true,
    eyebrow: 'Elige tu presentación',
    titulo: '¿Cómo lo prefieres?',
    label1: 'Presentación Clásica',
    copy1: 'La opción original, lista para usar.',
    imagen1: '',
    categoria1: 'Clásico',
    label2: 'Presentación Especial',
    copy2: 'Pensada para quien busca algo distinto.',
    imagen2: '',
    categoria2: 'Especial',
    // Tarjetas 3-4 opcionales, VACÍAS por defecto → Nayoli renderiza 2 (byte-idéntico). Un cliente
    // con 3-4 presentaciones las llena en el editor.
    label3: '', copy3: '', imagen3: '', categoria3: '',
    label4: '', copy4: '', imagen4: '', categoria4: '',
    // La canónica (§ eje 5e): Nayoli queda byte-idéntica al mosaico de hoy.
    variante: 'mosaico',
  },
  subscriptionCTA: {
    visible: true,
    eyebrow: 'Plan Suscripción',
    titulo: 'Tu pedido, cada mes',
    subtitulo: 'Recibe lo de siempre sin tener que acordarte de pedirlo cada vez.',
    bullet1: 'Siempre lo mismo, sin que tengas que volver a elegirlo',
    bullet2: 'Elige la presentación que prefieras',
    bullet3: 'Se renueva automáticamente, sin líos',
    bullet4: 'Pausa o cancela cuando quieras',
    ctaLabel: 'Ver los planes',
  },
  testimonials: {
    visible: true,
    eyebrow: 'Testimonios',
    titulo: 'Lo que dicen nuestros clientes',
    items: [], // VACÍO a propósito (§ SiteContent — el repeater): sin claims falsos en defaults; hide-on-empty oculta
  },
  // El relato largo de la página /nosotros. El default REUSA el texto real de brandStory (no se
  // fabrica copy); `parrafo3` nace vacío para que el owner expanda. La galería variable NO va acá:
  // entra como su propia sección en la tanda 2 (§ /nosotros — la galería).
  nosotrosHistoria: {
    visible: true,
    eyebrow: 'Quiénes Somos',
    titulo: 'Cómo llegamos hasta acá',
    parrafo1:
      'Este negocio empezó con ganas de hacerlo distinto: responder rápido, cumplir lo que prometemos, y tratar a cada cliente como si fuera el primero. Con el tiempo eso se volvió la forma en que trabajamos todos los días.',
    parrafo2:
      'Hoy seguimos con la misma idea: que elegir, pedir y recibir sea simple, y que cada persona que confía en nosotros sienta que valió la pena.',
    parrafo3: '',
  },
  // La galería de /nosotros. Encabezado con defaults de COPY (se muestran sólo cuando hay fotos, por
  // hide-on-empty); `items` VACÍO —las fotos de la finca son DATO del owner, no hay imagen que
  // fabricar en defaults—. Con items vacíos la sección no se renderiza.
  nosotrosGaleria: {
    visible: true,
    eyebrow: 'Galería',
    titulo: 'Nuestro trabajo en imágenes',
    items: [],
  },
  // Los PLANES de /suscripciones (antes `SUBSCRIPTION_PLANS` + los literales del encabezado). Byte a
  // byte: sin fila, /suscripciones y el teaser de la home quedan IDÉNTICOS. Precios VACÍOS (Nayoli no
  // lleva). Destacado = slot '2' (el Plan Estándar, que hoy es el `popular`). Cada plan trae 3
  // beneficios (ben*_1..3); el 4º queda vacío (el componente lo omite → 3 bullets, como hoy). Los
  // NOMBRES son genéricos por CANTIDAD RELATIVA, no por unidad (§ CONTENIDO-NEUTRALIZAR-3, arriba).
  suscripcionPlanes: {
    visible: true,
    eyebrow: 'Suscripción Mensual',
    titulo: 'Tu pedido,',
    tituloEnfasis: 'cada mes',
    subtitulo: 'Elige cuánto quieres recibir y con qué frecuencia. Cambia, pausa o cancela cuando quieras.',
    planesTitulo: 'Elige tu plan',
    planesSubtitulo: 'Escríbenos y coordinamos tu suscripción por WhatsApp. Sin compromisos, pausa o cancela cuando quieras.',
    ctaLabel: 'Me interesa',
    destacadoSlot: '2',
    nombre1: 'Plan Básico', descripcion1: 'La opción de entrada, cada mes.', precio1: '',
    ben1_1: 'La cantidad justa para empezar', ben1_2: 'Sin compromiso: cancela cuando quieras', ben1_3: 'Te llega el mismo día, cada mes', ben1_4: '',
    nombre2: 'Plan Estándar', descripcion2: 'El doble del plan básico, cada mes.', precio2: '',
    ben2_1: 'El doble de cantidad del plan básico', ben2_2: 'Pensado para quien ya sabe que quiere seguir', ben2_3: 'Nunca te quedas sin, mes tras mes', ben2_4: '',
    nombre3: 'Plan Familiar', descripcion3: 'El doble del plan estándar, para compartir.', precio3: '',
    ben3_1: 'El doble de cantidad del plan estándar', ben3_2: 'Ideal para el hogar o la oficina', ben3_3: 'Ajusta la fecha cuando lo necesites', ben3_4: '',
    nombre4: '', descripcion4: '', precio4: '',
    ben4_1: '', ben4_2: '', ben4_3: '', ben4_4: '',
  },
  // Los pasos "¿Cómo funciona?" (antes `SUBSCRIPTION_STEPS`). Los íconos van por índice en el componente.
  suscripcionPasos: {
    visible: true,
    titulo: '¿Cómo funciona?',
    paso1Label: 'Selecciona tu plan', paso1Desc: 'Selecciona la frecuencia y cantidad que mejor se adapte a ti.',
    paso2Label: 'Personaliza tu pedido', paso2Desc: 'Escoge la opción que mejor se ajuste a lo que buscas.',
    paso3Label: 'Confirmamos tu pedido', paso3Desc: 'Te avisamos antes de que se procese, para que nunca haya sorpresas.',
    paso4Label: 'Recíbelo en casa', paso4Desc: 'Enviamos tu pedido a todo el país.',
  },
  // La FAQ de /suscripciones (§ SUSCRIPCIONES-FAQ-DATO-1). NACE VACÍA a propósito: las cuatro
  // respuestas del `constants/subscription-faq.ts` retirado eran FALSAS —prometían pausar "desde tu
  // cuenta" (ruta borrada), cobro mensual recurrente y cambio "desde el siguiente ciclo" (no hay
  // cobro recurrente en el sistema) y "envío gratis a nivel nacional" (no existe esa regla)— y no se
  // copian. `titulo` conserva el único literal que el componente viejo pintaba (el `<h2>` fijo), sin
  // ningún claim. El owner carga preguntas REALES por el editor; hasta entonces, hide-on-empty oculta
  // la sección y /preguntas-frecuentes redirige (§ faqSuscripcionesVisible).
  suscripcionFaq: {
    visible: true,
    titulo: 'Preguntas frecuentes',
    items: [],
  },
  // DEFAULT ENCENDIDA (Nayoli tiene historia real): al deployar, /nosotros queda viva y el enlace
  // "Nosotros" apunta a la página. Un cliente que no la use la apaga (§ decisión del owner). NO es
  // un claim falso —es copy editable, no una reseña inventada—, así que default-encendida no repite
  // el caso de los testimonios.
  // suscripciones DEFAULT ENCENDIDA (Nayoli propone suscripciones): al deployar, /suscripciones queda
  // viva con sus planes y el CTA "Me interesa" por WhatsApp. Un cliente que no venda suscripciones la
  // apaga → la página redirige, y el nav/footer/home CTA la esconden juntos (§ Backlog #49, opción 2).
  paginas: {
    nosotros: { visible: true },
    suscripciones: { visible: true },
  },
  // TEMA por defecto: las 3 raíces en null → el storefront usa los defaults de código (§ globals.css
  // `--sf-*`), que SON la paleta de Nayoli → byte-idéntico sin depender de una fila. Un cliente setea
  // sus raíces y el motor deriva el resto. La migración NO siembra `tema` (loader SOFT, como todo
  // SiteContent): sin la clave, `resolverTema` la resuelve a estos nulls.
  tema: {
    fondo: null,
    tinta: null,
    acento: null,
    fuentePar: null,   // Editorial (Inter/Playfair) — el default byte-idéntico
    forma: null,       // Suave (radios de hoy) — el default byte-idéntico
  },
  // ESQUEMAS por defecto: el mapa nace VACÍO a propósito (§ eje 5b, mitad B). Ninguna banda tiene
  // entrada → todas caen a su token CANÓNICO de hoy (tinta/tinta-2/fondo/superficie, cada una la
  // suya) → Nayoli byte-idéntica. NO pre-llenar con 'crema'/'oscuro': eso rompería `tinta-2`
  // (SubscriptionCTA, un oscuro cálido DISTINTO de `oscuro`=tinta) y el blanco puro de hoy contra
  // el texto cálido 8.49:1 que sólo aparece cuando un tenant ASIGNA el esquema.
  esquemas: {},
  // ORDEN por defecto: la secuencia de HOY del home (§ eje 5, parte c) — el mismo `[...BANDA_IDS]`
  // que `ORDEN_DEFAULT`. Sin fila, `.map` en `page.tsx` produce el MISMO árbol que el JSX fijo de
  // ayer → byte-idéntico.
  orden: ORDEN_DEFAULT,
};

// Destinos de los CTA — ESTRUCTURA, no editable. Los labels se editan; los hrefs NO: un
// href arbitrario en el botón principal de la portada lo dejaría apuntando a una ruta que
// no existe. La salida (si algún día se pide editarlos) es un selector entre rutas CONOCIDAS,
// no un campo libre (§ Config del contenido — SiteContent, en doctrina).
export const HERO_HREFS = { primario: '/tienda', secundario: '/suscripciones' } as const;

// El destino de las tarjetas de Presentaciones DEJÓ de ser ESTRUCTURA: es DATO (`categoria1/2` de la
// sección, editables con el combobox de categorías reales). `PRESENTACIONES_HREFS` se retiró — un path
// FIJO hacia un texto que el cliente escribe libremente se rompe solo: el owner escribió "Café grano"
// en un producto y el link "Café en Grano" dejó de traer nada. La C1 había asumido un SET CERRADO de
// categorías (path = estructura); C3 mató esa premisa (taxonomía derivada, texto libre), así que el
// destino tiene que seguir al dato. El href lo construye `hrefCategoria(categoria)` (§ lib/productos/
// categorias) desde el valor editable; el default resuelve a las categorías de hoy (byte-idéntico).

// ── El REGISTRY: la naturaleza de cada sección y campo ───────────────────────
// Es lo que deja el MODELO listo para BrandStory/Testimonials/SubscriptionCTA (que entran
// como datos, sin tocar esta mecánica):
//  · `ocultable`: si el editor ofrece el toggle de visibilidad. El HERO es `false` —una home
//    sin encabezado no es un caso de v1—; su `visible` queda fijo.
//  · `repeater`: la sección se auto-oculta con el array vacío (hide-on-empty). Testimonios
//    será el primero.
//  · campos `requerido` (vacío → default; el storefront no puede quedar sin ese dato) vs
//    `opcional` (vacío → el render lo OMITE).
export type CampoTipo = 'requerido' | 'opcional';

// VARIANTES DE COMPOSICIÓN (§ eje 5e): una sección puede declarar el mismo contenido con OTRO
// esqueleto. No es color (`content.tema`/`esquemas`) ni contenido (los `campos`): es una propiedad
// de la SECCIÓN, hermana exacta de `repeater`. `claves` es el set CERRADO de composiciones válidas;
// `canonica` es la de Nayoli — resuelve `''`, null, ausente y basura (§ `resolverVariante`).
//
// NACE SIN `sobreOscuro` A PROPÓSITO: sería un SEGUNDO origen de verdad sobre si la banda es oscura,
// y esa verdad ya es ÚNICA y EXPLÍCITA (`bandaEsOscura`, `esquema-style.ts` — por esquema asignado, o
// la canónica `BANDAS_OSCURAS` sin esquema). Repetirla acá reintroduciría la familia de suposición
// heredada que ese mecanismo existe para cerrar.
export interface VariantesDef {
  /** El set CERRADO de claves de composición de esta sección. */
  claves: readonly string[];
  /** La canónica —la de Nayoli—. Es lo que resuelve `''`, null, ausente y basura. */
  canonica: string;
  /** Las claves cuya banda NO es UNIFORME (bi-tonal / partida): el nav transparente-flotante no
   *  puede leerse sobre ellas (ningún color de texto único sirve para las dos zonas) → el nav cae
   *  a SÓLIDO. Ausente = todas las variantes son uniformes. NO es darkness (§ el rechazo de
   *  `sobreOscuro` arriba): la darkness tiene fuente DINÁMICA (un esquema asignado puede
   *  oscurecer/aclarar CUALQUIER banda) y por eso se COMPUTA (`bandaEsOscura`) en vez de
   *  declararse — declararla acá sería un 2º origen que puede discrepar del esquema, la mina que
   *  `sobreOscuro` existía para cerrar. La UNIFORMIDAD no tiene fuente dinámica: un esquema no
   *  parte ni une una banda — la ficha es partida tenga los colores que tenga —, así que es puro
   *  LAYOUT sin otra fuente con la que discrepar, y la variante es su fuente ÚNICA correcta. Único
   *  consumidor: `tratamientoNav` (esquema-style.ts). */
  noUniformes?: readonly string[];
}

export interface SeccionDef {
  /** Nombre de la sección en el selector del editor (§ /admin/tienda). */
  label: string;
  ocultable: boolean;
  /** Sección de LISTA: `itemsKey` es la clave del array; `campos` es la config de campos de CADA
   *  ÍTEM (requerido/opcional, para el resolver). Los campos NO-string del ítem (p. ej. un rating
   *  numérico) no van acá: el resolver los pasa tal cual. Coexiste con `campos` de sección. */
  repeater?: { itemsKey: string; campos: Record<string, CampoTipo> };
  /** Sección con VARIANTES de composición (§ eje 5e). Hermano de `repeater`: declara el set cerrado
   *  y la canónica; el resolver escribe `sec.variante` con `resolverVariante`. */
  variantes?: VariantesDef;
  campos: Record<string, CampoTipo>;
  /** Nombres de los campos que son IMÁGENES (blobs). Los lee el borrado de blobs reemplazados
   *  (`imagenesDe`), NO el resolver. Para un repeater la imagen vive en cada item. */
  imagenes?: string[];
}

// Las claves de SECCIÓN (todo `SiteContentData` menos las META `paginas`, `tema`, `esquemas` y
// `orden`, que no son secciones). El REGISTRY las cubre a todas; las cuatro metas quedan fuera a
// propósito —cada una se resuelve aparte del loop de secciones.
export type SeccionKey = Exclude<keyof SiteContentData, 'paginas' | 'tema' | 'esquemas' | 'orden'>;

export const REGISTRY: Record<SeccionKey, SeccionDef> = {
  hero: {
    label: 'Portada',
    ocultable: false,
    imagenes: ['imagen'],
    // VARIANTES DE COMPOSICIÓN (§ eje 5, EJE-5-VARIANTES-HERO): 'curtina' es la canónica —el hero de
    // HOY, verbatim—; 'ficha' es la nueva (tipografía en tinta sobre crema, foto a sangre a la
    // derecha, sin degradado). Segunda sección con `variantes`, tras `presentaciones` (§ eje 5e).
    // `noUniformes: ['ficha']` (§ EJE-5-NAV-UNIFORME): la ficha es BI-TONAL —crema a la izquierda,
    // foto oscura a la derecha— y ningún color de texto único del nav se lee sobre las dos mitades;
    // el nav transparente-flotante cae a SÓLIDO sobre ella (§ `tratamientoNav`, esquema-style.ts).
    variantes: { claves: ['curtina', 'ficha'], canonica: 'curtina', noUniformes: ['ficha'] },
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
      tituloEnfasis: 'opcional',
      subtitulo: 'requerido',
      ctaPrimarioLabel: 'requerido',
      ctaSecundarioLabel: 'opcional',
      imagen: 'requerido',
    },
  },
  brandStory: {
    label: 'Historia',
    ocultable: true,
    imagenes: ['imagen1', 'imagen2', 'imagen3', 'imagen4'],
    // VARIANTES DE COMPOSICIÓN (§ eje 5e, TEMAS-P2-BRANDSTORY-1) — PRERREQUISITO del programa de
    // themes, no una forma nueva: 'columnas' es la ÚNICA clave y la canónica —el layout de HOY,
    // verbatim (texto a un lado, collage 2×2 al otro, `grid-cols-1 lg:grid-cols-2`)—. Abre el slot
    // para que el theme que la necesite (tres de los cinco del programa) declare su alternativa sin
    // tocar esta mecánica; el día que exista una segunda clave, `BrandStory.tsx` gana su dispatcher.
    // `noUniformes`: NO — la banda es de un solo tono sólido (`bg-[var(--sf-banda,var(--sf-tinta))]`),
    // nunca bi-tonal, y con una sola clave no hay otra variante con la que discrepar.
    variantes: { claves: ['columnas'], canonica: 'columnas' },
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
      parrafo1: 'requerido',
      parrafo2: 'opcional',
      imagen1: 'requerido',
      imagen2: 'requerido',
      imagen3: 'requerido',
      imagen4: 'requerido',
    },
  },
  presentaciones: {
    label: 'Presentaciones',
    ocultable: true,
    // Cardinalidad VARIABLE 2-4: campos PLANOS con imágenes, como brandStory —NO un repeater—.
    // Los cuatro campos-imagen se borran de Blob por diff (`imagenesDe` lee esto). Tarjetas 1-2
    // REQUERIDAS (vacío cae al default de Nayoli → mínimo 2); 3-4 OPCIONALES (vacío se respeta → la
    // tarjeta no se muestra si no se llena). `categoriaN` = el DESTINO (§ el destino es DATO).
    imagenes: ['imagen1', 'imagen2', 'imagen3', 'imagen4'],
    // VARIANTES DE COMPOSICIÓN (§ eje 5e): 'mosaico' es la canónica —el GrindChooser de HOY,
    // verbatim—; 'indice' es la nueva (filas numeradas). Ninguna otra sección declara `variantes`
    // en este slice.
    variantes: { claves: ['mosaico', 'indice'], canonica: 'mosaico' },
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
      label1: 'requerido',
      copy1: 'requerido',
      imagen1: 'requerido',
      categoria1: 'requerido',
      label2: 'requerido',
      copy2: 'requerido',
      imagen2: 'requerido',
      categoria2: 'requerido',
      label3: 'opcional',
      copy3: 'opcional',
      imagen3: 'opcional',
      categoria3: 'opcional',
      label4: 'opcional',
      copy4: 'opcional',
      imagen4: 'opcional',
      categoria4: 'opcional',
    },
  },
  subscriptionCTA: {
    label: 'Suscripción',
    ocultable: true,
    // Sin `imagenes`: sección de solo texto. Los bullets son OPCIONALES → vaciarlos los omite (el
    // componente los junta con `.filter`), así que dan "hasta 4" sin hueco, no "4 slots fijos".
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
      subtitulo: 'requerido',
      bullet1: 'opcional',
      bullet2: 'opcional',
      bullet3: 'opcional',
      bullet4: 'opcional',
      ctaLabel: 'requerido',
    },
  },
  testimonials: {
    label: 'Testimonios',
    ocultable: true,
    // Campos de SECCIÓN (el encabezado). La LISTA va en `repeater.campos` (campos del ítem):
    // name/text requeridos, city/product opcionales. `stars` NO va acá —es número, el resolver lo
    // pasa tal cual—.
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
    },
    repeater: {
      itemsKey: 'items',
      campos: {
        name: 'requerido',
        city: 'opcional',
        text: 'requerido',
        product: 'opcional',
      },
    },
  },
  nosotrosHistoria: {
    label: 'Historia',
    ocultable: false, // el ocultar es a nivel de PÁGINA (paginas.nosotros.visible), no de esta sección
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
      parrafo1: 'requerido',
      parrafo2: 'opcional',
      parrafo3: 'opcional',
    },
  },
  nosotrosGaleria: {
    label: 'Galería',
    ocultable: true,
    // `imagenes` nombra los campos-BLOB DENTRO de cada ítem: `imagenesDe` itera los items del repeater
    // y junta cada `item[campo]` para el borrado de blobs reemplazados/quitados. `url` (la foto o el
    // vídeo) Y `poster` (la imagen del vídeo): un ítem-vídeo quitado borra los DOS blobs; un ítem-imagen
    // no tiene `poster`, así que `empujarUrl` lo saltea. El encabezado (eyebrow/titulo) es OPCIONAL. La
    // LISTA va en `repeater.campos`: url requerida (sin archivo no hay ítem), alt opcional.
    imagenes: ['url', 'poster'],
    campos: {
      eyebrow: 'opcional',
      titulo: 'opcional',
    },
    repeater: {
      itemsKey: 'items',
      campos: {
        url: 'requerido',
        alt: 'opcional',
      },
    },
  },
  // Los PLANES de /suscripciones. Encabezado + "Elige tu plan" + 4 slots de plan (1 requerido, 2-4
  // opcionales). Plan 1: nombre/descripcion REQUERIDOS (default de Nayoli → mínimo 1 plan); precio y
  // beneficios OPCIONALES. Planes 2-4: TODO opcional (nombre vacío → el componente omite el plan).
  // `destacadoSlot` opcional (vacío = ninguno). Como Presentaciones: el resolver NO decide la
  // cardinalidad, sólo default-vs-omit por campo; el componente filtra los planes visibles.
  suscripcionPlanes: {
    label: 'Planes',
    ocultable: false, // el ocultar es a nivel de PÁGINA (paginas.suscripciones.visible), no de esta sección
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
      tituloEnfasis: 'opcional',
      subtitulo: 'requerido',
      planesTitulo: 'requerido',
      planesSubtitulo: 'opcional',
      ctaLabel: 'requerido',
      destacadoSlot: 'opcional',
      nombre1: 'requerido', descripcion1: 'requerido', precio1: 'opcional',
      ben1_1: 'opcional', ben1_2: 'opcional', ben1_3: 'opcional', ben1_4: 'opcional',
      nombre2: 'opcional', descripcion2: 'opcional', precio2: 'opcional',
      ben2_1: 'opcional', ben2_2: 'opcional', ben2_3: 'opcional', ben2_4: 'opcional',
      nombre3: 'opcional', descripcion3: 'opcional', precio3: 'opcional',
      ben3_1: 'opcional', ben3_2: 'opcional', ben3_3: 'opcional', ben3_4: 'opcional',
      nombre4: 'opcional', descripcion4: 'opcional', precio4: 'opcional',
      ben4_1: 'opcional', ben4_2: 'opcional', ben4_3: 'opcional', ben4_4: 'opcional',
    },
  },
  // Los pasos "¿Cómo funciona?" — cardinalidad FIJA 4, todos REQUERIDOS (empty → default; no se
  // agregan/quitan pasos en v1). Íconos y número por índice en el componente (estructura).
  suscripcionPasos: {
    label: 'Cómo funciona',
    ocultable: true,
    campos: {
      titulo: 'requerido',
      paso1Label: 'requerido', paso1Desc: 'requerido',
      paso2Label: 'requerido', paso2Desc: 'requerido',
      paso3Label: 'requerido', paso3Desc: 'requerido',
      paso4Label: 'requerido', paso4Desc: 'requerido',
    },
  },
  // La FAQ de /suscripciones (§ SUSCRIPCIONES-FAQ-DATO-1). REPEATER, gemela de `testimonials`: un
  // encabezado (`titulo`) + una LISTA de preguntas. `question`/`answer` LOS DOS requeridos —una
  // pregunta sin respuesta es un hueco, no media FAQ—. `ocultable:true`: un cliente puede querer los
  // planes y los pasos sin una FAQ, además del gate de PÁGINA (`paginas.suscripciones.visible`).
  suscripcionFaq: {
    label: 'Preguntas frecuentes',
    ocultable: true,
    campos: {
      titulo: 'requerido',
    },
    repeater: {
      itemsKey: 'items',
      campos: {
        question: 'requerido',
        answer: 'requerido',
      },
    },
  },
};

const esVacio = (v: unknown): boolean => typeof v !== 'string' || v.trim() === '';
const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Normaliza la `variante` guardada a una clave del set CERRADO de la sección, o la CANÓNICA
 * (§ eje 5e). Gemela de `resolverForma`/`resolverFuentePar`: `''`, null, ausente, basura u objeto
 * → la canónica; NUNCA lanza. A diferencia de esas dos (donde el default es `null` = "sin
 * override"), acá el default ES un valor del set — la canónica es una variante de verdad, no la
 * ausencia de una.
 */
export function resolverVariante(def: VariantesDef, v: unknown): string {
  return typeof v === 'string' && def.claves.includes(v) ? v : def.canonica;
}

/**
 * Merge SOFT del contenido guardado sobre los DEFAULTS. Por campo:
 *  · `requerido` vacío/ausente → el DEFAULT (el storefront nunca queda sin ese dato);
 *  · `opcional` PRESENTE (aun vacío) → se respeta (vacío = el render lo omite);
 *    `opcional` AUSENTE → el DEFAULT (así el editor lo pre-llena la primera vez).
 * NUNCA lanza. `visible` sólo se sobreescribe con un booleano explícito.
 */
// Parametrizado en `registro`/`defaultsBase` (como `seccionEsVisible` e `imagenesDe`) para probar
// la rama repeater con una sección SINTÉTICA, sin depender de que exista una repeater real.
export function resolverSiteContent(
  stored: unknown,
  registro: Record<string, SeccionDef> = REGISTRY,
  defaultsBase: Record<string, unknown> = DEFAULTS as unknown as Record<string, unknown>,
): SiteContentData {
  const raw = esObj(stored) ? stored : {};
  const out = {} as Record<string, unknown>;

  // Se itera por `registro` (las SECCIONES), no por `defaultsBase`: así las claves que NO son sección
  // —`paginas`, `tema`— no entran al loop de secciones y se resuelven aparte, abajo.
  for (const key of Object.keys(registro)) {
    const def = registro[key];
    const defaults = defaultsBase[key] as Record<string, unknown>;
    const storedSec = esObj(raw[key]) ? (raw[key] as Record<string, unknown>) : {};
    const sec: Record<string, unknown> = { ...defaults };

    if (typeof storedSec.visible === 'boolean') sec.visible = storedSec.visible;

    for (const [campo, tipo] of Object.entries(def.campos)) {
      const val = storedSec[campo];
      if (tipo === 'requerido') {
        sec[campo] = esVacio(val) ? defaults[campo] : val;
      } else {
        sec[campo] = campo in storedSec ? (val ?? '') : defaults[campo];
      }
    }

    // REPEATER: resolver el ARRAY de items guardado. Sin esto, `sec[itemsKey]` se queda con el
    // array DEFAULT (`{...defaults}`) y toda edición del repeater se pierde EN SILENCIO.
    if (def.repeater) {
      sec[def.repeater.itemsKey] = resolverItems(def.repeater.campos, storedSec[def.repeater.itemsKey]);
    }

    // VARIANTES (§ eje 5e): resolver la composición guardada al set cerrado de la sección, o la
    // canónica. `''`, null, ausente y basura → la canónica.
    if (def.variantes) sec.variante = resolverVariante(def.variantes, storedSec.variante);

    out[key] = sec;
  }

  // PÁGINAS (meta, no sección): sólo `visible` booleano por página; el default manda si el guardado
  // no trae un booleano explícito. Es lo que gatea el redirect de /nosotros y el enlace del nav.
  out.paginas = resolverPaginas(raw.paginas, defaultsBase.paginas);
  // TEMA (meta, no sección): las 3 raíces de paleta, resueltas aparte del loop igual que `paginas`.
  out.tema = resolverTema(raw.tema, defaultsBase.tema);
  // ESQUEMAS (meta, no sección): el mapa banda→esquema, resuelto aparte del loop igual que `paginas`
  // y `tema` — pero KEY-AGNÓSTICO (§ `resolverEsquemas`, abajo): a diferencia de esas dos, no hay un
  // `defaults` con un set fijo de claves que enumerar.
  out.esquemas = resolverEsquemas(raw.esquemas);
  // ORDEN (meta, no sección): la secuencia de bandas, resuelta aparte del loop igual que las otras
  // tres — pero con dominio CERRADO (§ `resolverOrden`, abajo), a diferencia de `esquemas`.
  out.orden = resolverOrden(raw.orden);
  return out as unknown as SiteContentData;
}

// Resuelve la meta de páginas: por cada página del default, `visible` sale del guardado sólo si es
// booleano explícito; si no, del default. SOFT, nunca lanza.
export function resolverPaginas(stored: unknown, defaults: unknown): Record<string, { visible: boolean }> {
  const def = esObj(defaults) ? defaults : {};
  const st = esObj(stored) ? stored : {};
  const out: Record<string, { visible: boolean }> = {};
  for (const pagina of Object.keys(def)) {
    const dv = esObj(def[pagina]) && typeof (def[pagina] as Record<string, unknown>).visible === 'boolean'
      ? (def[pagina] as { visible: boolean }).visible : true;
    const sv = esObj(st[pagina]) ? (st[pagina] as Record<string, unknown>).visible : undefined;
    out[pagina] = { visible: typeof sv === 'boolean' ? sv : dv };
  }
  return out;
}

// Resuelve el TEMA (las 3 raíces de paleta), gemela de `resolverPaginas`: una clave no-sección
// resuelta aparte del loop de secciones. Cada raíz sale del guardado sólo si es un hex de 6 dígitos
// VÁLIDO; si no —null, vacío, o basura—, cae al default (que es null → el storefront usa los
// defaults de código, § cssPaleta). SOFT, nunca lanza. La validación que MANDA es el write
// (`paletaEditableSchema`); ésta es la defensa del loader SOFT, que jamás debe romper por un valor
// corrupto en la fila (una raíz `'rojo'` editada a mano no llega al motor de derivación).
const HEX6_TEMA = /^#[0-9a-fA-F]{6}$/;
export function resolverTema(stored: unknown, defaults: unknown): TemaContent {
  const st = esObj(stored) ? stored : {};
  const def = esObj(defaults) ? defaults : {};
  const raiz = (k: string): string | null => {
    const sv = st[k];
    if (typeof sv === 'string' && HEX6_TEMA.test(sv)) return sv;
    const dv = def[k];
    return typeof dv === 'string' && HEX6_TEMA.test(dv) ? dv : null;
  };
  // El par tipográfico y la forma: clave CUSTOM válida, o null (Editorial/Suave). `resolverFuentePar`/
  // `resolverForma` normalizan null, la clave del default y basura → null (§ fuentes, § formas). No usan
  // `defaults` porque el default ES null.
  return {
    fondo: raiz('fondo'), tinta: raiz('tinta'), acento: raiz('acento'),
    fuentePar: resolverFuentePar(st['fuentePar']),
    forma: resolverForma(st['forma']),
  };
}

const ESQUEMA_IDS = new Set<ClaveEsquema>(['crema', 'superficie', 'oscuro', 'acento']);

/**
 * Resuelve el mapa banda→esquema (§ eje 5b), gemelo de `resolverPaginas`/`resolverTema` pero
 * KEY-AGNÓSTICO: aquellas enumeran un set FIJO de páginas/raíces conocido de antemano por su
 * `defaults`; acá el set de bandaIds es ABIERTO —cualquier sección del home puede tener una
 * entrada—, así que se itera el GUARDADO, no un `def` fijo. Cada valor se valida contra el set
 * CERRADO de 4 esquemas; basura (o una clave ausente) NI SIQUIERA aparece en el resultado — es lo
 * que hace que el consumidor la lea como "sin override" (cae a su token canónico de hoy, § el
 * mecanismo de byte-identidad). SOFT, nunca lanza.
 */
export function resolverEsquemas(stored: unknown): EsquemasContent {
  const st = esObj(stored) ? stored : {};
  const out: EsquemasContent = {};
  for (const [banda, val] of Object.entries(st)) {
    if (typeof val === 'string' && ESQUEMA_IDS.has(val as ClaveEsquema)) out[banda] = val as ClaveEsquema;
  }
  return out;
}

const ORDEN_IDS = new Set<BandaId>(BANDA_IDS);

/**
 * Resuelve el ORDEN de las bandas del home (§ eje 5, parte c), gemelo de `resolverEsquemas` pero
 * con dominio CERRADO (`BANDA_IDS`) en vez de key-agnóstico. Filtra `stored` a ids CONOCIDOS,
 * DEDUPLICA (la primera aparición gana), y AGREGA al final —en el orden default— cualquier id
 * conocido que falte. Así un orden parcial, con repetidos, o pura basura SIEMPRE resuelve a la
 * lista COMPLETA de 7: ninguna banda puede caerse del home por un `orden` corrupto. `orden` NO
 * controla visibilidad (eso es `paginas`/`visible` por sección); es sólo SECUENCIA. SOFT, nunca
 * lanza — misma familia que el resto de los loaders de SiteContent.
 */
export function resolverOrden(stored: unknown): BandaId[] {
  const out: BandaId[] = [];
  const vistos = new Set<BandaId>();
  if (Array.isArray(stored)) {
    for (const v of stored) {
      if (typeof v === 'string' && ORDEN_IDS.has(v as BandaId) && !vistos.has(v as BandaId)) {
        out.push(v as BandaId);
        vistos.add(v as BandaId);
      }
    }
  }
  for (const id of BANDA_IDS) {
    if (!vistos.has(id)) out.push(id);
  }
  return out;
}

// Resuelve el array de items de una sección repeater. Cada ítem: los campos `requerido`/`opcional`
// (strings) se normalizan a string —el editor valida los requeridos, así que acá sólo se garantiza
// la forma—; los demás campos del ítem (p. ej. un rating numérico) pasan TAL CUAL. Un valor que no
// es objeto se descarta. NUNCA lanza (loader SOFT).
export function resolverItems(
  itemCampos: Record<string, CampoTipo>,
  storedItems: unknown,
): Record<string, unknown>[] {
  if (!Array.isArray(storedItems)) return [];
  const out: Record<string, unknown>[] = [];
  for (const item of storedItems) {
    if (!esObj(item)) continue;
    const resuelto: Record<string, unknown> = { ...item }; // passthrough (rating numérico, etc.)
    for (const [campo, tipo] of Object.entries(itemCampos)) {
      const val = item[campo];
      if (tipo === 'requerido') {
        resuelto[campo] = typeof val === 'string' ? val : '';
      } else {
        resuelto[campo] = campo in item ? (val ?? '') : '';
      }
    }
    out.push(resuelto);
  }
  return out;
}

/**
 * Overlay POR SECCIÓN del borrador sobre lo publicado, EN CRUDO (antes de resolver). Cada
 * sección presente en `borrador` PISA por completo la de `content` —el editor guarda secciones
 * completas, no campos sueltos—; las no borroneadas quedan como en `content`. El resultado es el
 * objeto crudo que el loader de borrador pasa a `resolverSiteContent`. Publicar una sección no
 * arrastra otra porque el borrador es un mapa PARCIAL (sólo trae las secciones borroneadas).
 */
export function mezclarBorrador(content: unknown, borrador: unknown): Record<string, unknown> {
  const c = esObj(content) ? content : {};
  const b = esObj(borrador) ? borrador : {};
  return { ...c, ...b };
}

/**
 * ¿Se muestra la sección? `visible` + hide-on-empty para repeaters. Recibe el def y la
 * sección ya resuelta (parametrizado para probarlo sin depender del REGISTRY global).
 *  · `ocultable: false` → siempre visible, salvo que sea repeater y su array esté vacío.
 *  · repeater → se oculta con el array vacío, aunque `visible` sea true.
 */
// `sec: object` para aceptar tanto los literales de test como los tipos de sección CONCRETOS
// (`BrandStoryContent`, …), que no tienen index signature y por eso no encajan en un
// `Record<string, unknown>` a secas. Se lee por el cast (`visible` e `itemsKey` del repeater).
export function seccionEsVisible(def: SeccionDef, sec: object): boolean {
  const rec = sec as Record<string, unknown>;
  const items = def.repeater ? rec[def.repeater.itemsKey] : undefined;
  const tieneItems = Array.isArray(items) && items.length > 0;

  if (def.repeater && !tieneItems) return false; // hide-on-empty gana sobre todo
  if (!def.ocultable) return true;                // no se puede ocultar (hero)
  return rec.visible !== false;
}

/**
 * ¿Debe mostrarse /preguntas-frecuentes —y su enlace, en el footer— (§ SUSCRIPCIONES-FAQ-DATO-1)?
 * Compone DOS condiciones: la CAPACIDAD de suscripciones está encendida
 * (`paginas.suscripciones.visible` — la FAQ es hoy contenido de esa capacidad, la misma que gatea el
 * 2º CTA del hero, el nav, el footer y el bloque de la home, § Backlog #49) Y la sección
 * `suscripcionFaq` se muestra (`seccionEsVisible`, que ya cubre su propio toggle Y hide-on-empty).
 * Sin las dos, la página quedaría en BLANCO —su único contenido es esta FAQ— y su enlace apuntaría a
 * nada. UNA función para los DOS consumidores (la ruta y `StoreFooter`): escribir la condición dos
 * veces es la falla de las dos declaraciones que este repo ya pagó varias veces (§ CLAUDE.md,
 * `razonDelServidor`/`cruzoMinimo`).
 */
export function faqSuscripcionesVisible(content: SiteContentData): boolean {
  return content.paginas.suscripciones.visible && seccionEsVisible(REGISTRY.suscripcionFaq, content.suscripcionFaq);
}
