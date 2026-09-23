// DEFAULTS + REGISTRY + resolver del CONTENIDO del storefront. Módulo PURO —sin prisma,
// sin server-only— para que capa 1 lo pruebe y para que el carril/route handlers lo usen.
//
// LOADER SOFT (lo opuesto a SiteSetting): el vacío es un estado LEGÍTIMO del editor, no un
// error. Nada falla ruidoso; un campo vacío cae al default (requerido) o se omite (opcional).
// Sin fila en la base, gobiernan estos defaults — por eso SiteContent no siembra fila en su
// migración.

import { resolverFuentePar, type ClaveFuentePar } from './fuentes';
import { resolverForma, type ClaveForma } from './formas';
import type { EsquemaId, OrigenTexto, OrigenAccion } from './palette-derive';
import { resolverEscalaDisplay, type ClaveEscalaDisplay } from './escala-display';

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
  // El TIPO del medio de fondo (§ HERO-VIDEO-COMO-DATO-1): 'imagen' (default, byte-idéntico) o
  // 'video'. Escalar de SECCIÓN CLAMPADO —como `variante`, dos líneas abajo—, resuelto con
  // `resolverVariante` vía `REGISTRY.hero.escalares` (nunca un `campos`, nunca un string libre): el
  // hero es `ocultable:false` —la ÚNICA portada del sitio—, así que un valor corrupto acá gobernaría
  // lo primero que ve el visitante, y el resolver SOFT tiene que devolver SIEMPRE algo renderizable.
  imagenTipo: 'imagen' | 'video';
  // El PÓSTER del video: la imagen que se ve mientras el video buferea / antes de reproducir.
  // OBLIGATORIO cuando `imagenTipo === 'video'` — lo exige el `.refine()` de `heroEditableSchema`
  // (§ site-content-schema.ts), NO el resolver: el loader es SOFT (nunca lanza) y un hero de video
  // sin póster degrada con gracia (`<video>` sin `poster` simplemente no lo muestra, § HeroCurtina/
  // HeroFicha) — pero el WRITE no debe poder CREAR ese estado desde el editor. '' cuando
  // `imagenTipo` es 'imagen' (default, byte-idéntico).
  imagenPoster: string;
  // La VARIANTE de composición (§ eje 5, EJE-5-VARIANTES-HERO). 'curtina' (canónica, la de Nayoli) |
  // 'ficha'. Escalar de SECCIÓN —como `visible`—, no un `campos`: no lo toca el loop
  // requerido/opcional del resolver. Gemela de `presentaciones.variante` (§ eje 5e).
  variante: string;
  // TRES AGREGADOS del hero-media del prototipo que HeroMedia no tenía (§ TEMAS-HERO-MEDIA-
  // AGREGADOS-1, `docs/prototipos/cafeone/index.html:122-138` — `.hero-caption`/`.scroll-cue`).
  // Los TRES son OPT-IN con default = el hero-media de HOY (byte-idéntico): un tenant sin preset
  // (Nayoli incluida, que además usa `curtina` no `media`) no ve ni un byte nuevo.
  //
  // `ctasVisibles` (booleano, default `true` = los dos CTA de HOY). El prototipo no lleva botones
  // en el hero; acá se generaliza como un APAGADOR de los dos juntos —el prototipo trata "sin
  // botones" como un bloque, no un botón sí y el otro no— para que un preset que quiera esa lectura
  // minimalista no tenga que apagar cada CTA por separado.
  ctasVisibles: boolean;
  // `fraseAlPie` (string, OPCIONAL — como `eyebrow`/`tituloEnfasis`: default `''` → SE OMITE, no
  // cae a ningún texto de relleno). Es el `.hero-caption` del prototipo («Hay algo profundamente
  // meditativo en preparar un café cultivado a 1.600 msnm.», index.html:134-136) vuelto DATO del
  // tenant — nunca un literal horneado en el componente.
  fraseAlPie: string;
  // `cueDesliza` (booleano, default `false` = SIN cue, el hero-media de HOY). El `.scroll-cue` del
  // prototipo (index.html:137: línea vertical con un segmento que la recorre + la etiqueta
  // "Desliza"). Gemelo de `ctasVisibles` en mecánica (booleano de sección, § `SeccionDef.
  // booleanos` abajo); su animación vive en `HeroMedia.tsx` sobre un `motion.span` con un valor de
  // TRANSFORM (`y`) para que `ReducedMotionProvider` (`lib/animation.ts`, `MotionConfig
  // reducedMotion="user"`, montado en `app/(storefront)/layout.tsx`) la congele bajo
  // `prefers-reduced-motion` SIN que este archivo ni el componente inventen un guard propio.
  cueDesliza: boolean;
  // DOS TOGGLES MÁS, ESPEJO EXACTO de `ctasVisibles` en mecánica (§ CORTE-HERO-TITULAR-OCULTABLE-1):
  // el `.hero-inner` del prototipo (index.html:130-138) no lleva NI eyebrow/titular NI subtítulo —
  // sólo `.hero-caption` (`fraseAlPie`, arriba) y `.scroll-cue` (`cueDesliza`, arriba). `ctasVisibles`
  // apaga los dos CTA como UN bloque; éstos apagan el TITULAR (`titulo`+`tituloEnfasis`, un solo
  // bloque — el énfasis es parte del titular, no un elemento aparte) y el SUBTÍTULO cada uno con su
  // PROPIO apagador: a diferencia de los CTA (que el prototipo trata como un bloque único), titular y
  // subtítulo son dos elementos separados del `.hero-inner` y no hay evidencia de que deban apagarse
  // juntos.
  //
  // `titularVisible` (booleano, default `true` = el titular de HOY, `titulo`+`tituloEnfasis` juntos).
  // SÓLO `HeroMedia` lo lee — curtina y ficha no (mismo alcance que `ctasVisibles`, ver arriba).
  titularVisible: boolean;
  // `subtituloVisible` (booleano, default `true` = el `subtitulo` de HOY). SÓLO `HeroMedia` lo lee.
  subtituloVisible: boolean;
}

// LA BANDA MARQUESINA (§ MARQUESINA-BANDA-1, medido: MARQUESINA-BANDA-CENSO-1) — tres capas: foto
// de fondo velada con overlay oscuro, un LOOP de texto a gran escala que se desplaza con el scroll
// de la sección, y una tarjeta de producto flotante que escala/rota con el mismo progreso. Es la
// SEGUNDA sección del home en el prototipo (`docs/prototipos/cafeone/index.html:141-157`, entre
// `.hero` y `.spotlight`), y aparece UNA sola vez.
//
// ES BANDA PROPIA, NO UNA VARIANTE — a diferencia de `spotlight` (variante de `featured`), la
// marquesina COEXISTE con el hero y con `featured`/`spotlight`: son tres secciones distintas del
// prototipo, así que necesita su propio slot en `BANDA_IDS`, como `origen` (§ ORIGEN-BANDA-1).
//
// NACE OFF (`visible:false`, ver `DEFAULTS.marquesina` abajo), MISMA razón mecánica que `origen`:
// `resolverOrden` completa el orden de TODO tenant con TODA banda de `BANDA_IDS`, sin condición —
// estar en la lista no alcanza para mostrarse. Sin el `false`, Nayoli (o cualquier tenant sin fila
// propia) vería la banda aparecer sola, sin que nadie la haya pedido.
//
// `texto` es la FRASE del loop — el `.marquee-track` del prototipo repite el mismo texto dos veces
// para el efecto de cinta continua («Café fresco de San Adolfo — Huila — Colombia —»); acá es UN
// campo de dato del tenant (REQUERIDO, con default GENÉRICO — nunca la frase del prototipo, misma
// razón que `origen.titulo`/`.lede`: `mergePresetEnContent` jamás escribe texto de sección, así que
// el ÚNICO texto que CORTE podría mostrar es este default, y una frase de origen geográfico
// («San Adolfo, Huila») sería una afirmación FALSA sobre el negocio de quien encienda la banda —la
// misma familia que el rating fabricado que se borró, § El RATING fabricado se BORRÓ, CLAUDE.md).
//
// `imagen` es la foto de fondo (REQUERIDA, reusa un asset estático existente — la banda nace OFF,
// sin urgencia de una foto propia, mismo criterio que `origen.imagen1/2`).
//
// `productoSlug` es el PIN de la tarjeta flotante — el MISMO mecanismo que `SpotlightContent.
// productoSlug` (§ su docstring, arriba en este archivo, para el porqué completo: puntero, nunca
// copia de nombre/precio/imagen). OPCIONAL: sin pin, la tarjeta simplemente no se muestra (hide-on-
// empty de UN elemento, no de la sección — el texto del loop no depende del producto).
export interface MarquesinaContent {
  visible: boolean;
  texto: string;
  imagen: string;
  productoSlug: string;
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
  // La VARIANTE de composición (§ eje 5e, TEMAS-P2-BRANDSTORY-1). 'columnas' es la canónica; 'centrada'
  // (§ CORTE-BRANDSTORY-COLLAGE-1) es la segunda clave — eyebrow+título centrados, el mismo collage a
  // lo ancho, el párrafo debajo (§ REGISTRY.brandStory.variantes). Escalar de SECCIÓN —como
  // `visible`—, no un `campos`: no lo toca el loop requerido/opcional del resolver. Gemela de
  // `hero.variante`/`presentaciones.variante`.
  variante: string;
}

// LA BANDA ORIGEN (§ ORIGEN-BANDA-1, medido: ORIGEN-BANDA-CENSO-1) — grid de 2 fotos + copy
// (antetítulo/título/lede) + una LISTA de 4 pares dato EDITORIALES A NIVEL FINCA (Altitud/Variedad/
// Proceso/Cosecha en el prototipo — NUNCA leídos de `Product`; es texto del dueño sobre el origen del
// negocio, no una ficha de producto) + 3 CONTADORES ANIMADOS (numero+etiqueta, § el CONTADOR en
// `lib/animation.ts`).
//
// A DIFERENCIA DE `spotlight` (que se quedó FUERA de `BANDA_IDS` porque es una VARIANTE de
// `featured`, no una banda propia, § el docstring de `SpotlightContent`), `origen` ES miembro de
// `BANDA_IDS`: coexiste con `brandStory` (la Historia) en vez de reemplazarla —son dos secciones
// distintas del prototipo, `#origen` y `#nuestra-historia`—, así que necesita su PROPIA posición en
// la secuencia del home, no un slot de variante prestado.
//
// NACE OFF (`visible:false`, ver DEFAULTS.origen abajo) por la MISMA razón MECÁNICA que hizo nacer a
// spotlight apagado mientras estuvo fuera de `BANDA_IDS`: `resolverOrden` completa el orden de TODO
// tenant con TODA banda de `BANDA_IDS`, sin condición — estar en la lista no alcanza para mostrarse,
// sólo decide DÓNDE renderiza SI se muestra. `visible:false` es lo único que impide que la sola
// presencia en `orden` encienda la banda para Nayoli (o cualquier tenant) sin que nadie la haya
// pedido. CORTE es hoy el ÚNICO preset que la enciende, vía `PresetTema.bandaOrigenVisible` (§
// `mergePresetEnContent`, themes.ts) — NUNCA vía membresía en `orden`: ese campo no puede ser la
// señal, porque `ORDEN_DEFAULT = [...BANDA_IDS]` alimenta también a ARRANQUE/VITRINA/PATIO (los tres
// usan el spread), así que "estar en el orden resuelto" es universal, no exclusivo de CORTE.
//
// LOS 4 PARES DATO Y LOS 3 STATS SON CARDINALIDAD FIJA (mismo patrón que `suscripcionPasos`: slot +
// subcampos, campos planos — no un repeater, por la misma razón que Presentaciones: un repeater no
// puede dar defaults byte-idénticos, § La BIFURCACIÓN de cardinalidad, CLAUDE.md). PERO el LABEL y
// el VALOR de cada par NO comparten obligatoriedad, y es DELIBERADO:
//
//   · `dato1..4Label` son REQUERIDOS — son nombres de CATEGORÍA genéricos ("Origen", "Selección"…),
//     no una afirmación verificable, así que un default siempre puede tener uno razonable.
//   · `dato1..4Valor` y los `statNumeroN`/`statEtiquetaN` son OPCIONALES, vacíos por defecto — cada
//     uno es una AFIRMACIÓN FACTUAL sobre ESTE negocio (una altitud, un conteo, un número de años),
//     y `mergePresetEnContent` (themes.ts) JAMÁS escribe texto de sección — sólo enciende `visible`
//     (igual que con `spotlight.visible`) —, así que el ÚNICO valor que CORTE podría mostrar es el
//     DEFAULT. Inventar un número («1.600 msnm», «52 años») en un DEFAULT COMPARTIDO por TODO
//     tenant sin fila propia sería fabricar un dato — la misma familia que el rating fabricado que
//     se borró (§ El RATING fabricado se BORRÓ, CLAUDE.md) y que el precio vacío de
//     `SuscripcionPlanesContent` ya evita («el precio es TEXTO OPCIONAL... un precio inventado sería
//     dato falso en la ruta del dinero» — acá el dato no es dinero, pero es la MISMA clase de
//     afirmación no verificable). Vacío se OMITE (§ `Origen.tsx`: una fila de dato sin valor, o un
//     contador sin número, no se renderiza) — nunca un placeholder inventado.
//
// Consecuencia medida y aceptada: bajo `?tema=CORTE`, sin panel todavía para cargar datos reales
// (§3 del spec de este slice — el panel queda de follow-up), la lista de datos y los contadores
// rinden VACÍOS (sólo el copy de cabecera se ve) — el MISMO comportamiento que ya tiene
// `featured·spotlight` bajo CORTE hoy (sin catálogo real, Spotlight rinde vacío, § spotlight-
// cableado.test.ts): una banda ENCENDIDA por el preset pero sin dato real que mostrar aún.
export interface OrigenContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  lede: string;
  imagen1: string;
  imagen2: string;
  dato1Label: string; dato1Valor: string;
  dato2Label: string; dato2Valor: string;
  dato3Label: string; dato3Valor: string;
  dato4Label: string; dato4Valor: string;
  // `statNumeroN` es TEXTO, no number — guarda el valor final tal como se muestra («1600»), y el
  // componente (`OrigenContador`, dentro de `Origen.tsx`) lo parsea para animar el count-up. Mismo
  // criterio que `precio` de `SuscripcionPlanesContent`: el formato es del cliente, no del sistema.
  // Vacío → el contador se OMITE (junto a su etiqueta), como cualquier otro par opcional de arriba.
  statNumero1: string; statEtiqueta1: string;
  statNumero2: string; statEtiqueta2: string;
  statNumero3: string; statEtiqueta3: string;
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

// LA BANDA SPOTLIGHT (§ SPOTLIGHT-BANDA-1) — un solo producto PINEADO, del muestrario del
// prototipo («Un solo origen, cuidado de principio a fin.»). Reemplaza a la lista plana de
// productos («Selección del mes», `FeaturedProducts`/`featured`) en los presets que la elijan.
//
// `productoSlug` es EL PIN — un PUNTERO al `Product` vivo (§ SPOTLIGHT-CAPACIDAD-CENSO-1, medido:
// "la decisión es PUNTERO no copia"), NUNCA una copia de su nombre/descripción/notas/precio/
// imagen: copiarlos mentiría en silencio el día que el producto cambie, algo que la doctrina de
// este repo ya prohibió dos veces (el rating fabricado, la cuenta bancaria horneada). Todo lo
// demás que la banda muestra se LEE del producto pineado en cada render —`productoSpotlight`,
// abajo, es quien resuelve el puntero contra el catálogo—. `otroTamanoSlug` es un SEGUNDO puntero,
// opcional: el eje "tamaño" del prototipo (que ahí cambia precio/imagen EN EL LUGAR) NO se modela
// como variante agrupada —eso es Backlog #62, un proyecto transversal que una banda del
// muestrario no dispara—, así que se resuelve como un ENLACE a la OTRA talla (otro producto, otro
// slug), igual que el destino de Presentaciones (`categoria1/2`, § el destino es DATO).
//
// SECCIÓN OCULTABLE que NACE OFF (`visible:false`), a diferencia de TODAS las demás secciones
// ocultables del REGISTRY (que nacen `true`) — es la ÚNICA excepción, y tiene un motivo mecánico,
// no estético: `resolverOrden` (abajo) SIEMPRE completa el `orden` resuelto de CUALQUIER tenant
// con TODA banda que exista en `BANDA_IDS`, sin condición y sin que un tenant pueda pedir que
// falte una — es la garantía que hace que "ninguna banda se caiga del home por un orden
// corrupto" (§ su docstring). El día que `spotlight` se sume a `BANDA_IDS` (§ el bloqueo medido en
// DECISIONS.md, SPOTLIGHT-BANDA-1 — hoy TODAVÍA NO es miembro, precisamente por esto), esa misma
// garantía haría que la banda apareciera en el orden resuelto de TODO tenant, Nayoli incluida, sin
// que nadie la haya pedido — nacer OFF es lo que hace que su sola presencia en el orden no alcance
// para mostrarla. Es el mismo mecanismo que ya usan los repeaters vacíos (Testimonios, la
// Galería) para no encender solos en ningún tenant, expresado como un booleano en vez de un array
// vacío porque acá el dato no es una lista.
export interface SpotlightContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  badge: string;
  productoSlug: string;
  otroTamanoSlug: string;
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
  // La VARIANTE de composición (TEMAS-SUBSCRIPTIONCTA-LINEA-1, § eje 5e). 'bloque' (canónica, la de
  // Nayoli — texto + tarjetas de plan en dos columnas) | 'linea' (franja horizontal condensada: el
  // gancho, el título y el botón en una línea; el subtítulo y los bullets NO se renderizan en esa
  // composición, § SubscriptionCTALinea.tsx). Escalar de SECCIÓN —como `visible`—, no un `campos`: no
  // lo toca el loop requerido/opcional del resolver. Gemela de `hero.variante`/`brandStory.variante`/
  // `presentaciones.variante`.
  variante: string;
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

// Los TRES ítems CONOCIDOS del menú del nav (§ CROMO-MENU-COMO-DATO-1) — set CERRADO: no se
// agregan ni se quitan ítems, sólo se RENOMBRAN y se REORDENAN. El orden CANÓNICO (el de
// `StoreNav.tsx` antes de este slice) es tienda → suscripciones → nosotros.
export const MENU_ITEM_IDS = ['tienda', 'suscripciones', 'nosotros'] as const;
export type MenuItemId = typeof MENU_ITEM_IDS[number];

// El SET CERRADO de destinos del CTA del menú — mismo patrón que `HERO_HREFS` (abajo): el dueño
// ELIGE entre rutas que YA EXISTEN, nunca escribe una libre. Declarado UNA vez: tanto el render
// (`menuCtaHref`, abajo) como el validador del schema (`site-content-schema.ts`) leen esta lista,
// para que no diverjan.
export const MENU_CTA_DESTINOS = ['/tienda', '/suscripciones', '/nosotros'] as const;
export type MenuCtaDestino = typeof MENU_CTA_DESTINOS[number];

// El MENÚ del nav (§ CROMO-MENU-COMO-DATO-1). Los TRES ítems son CONOCIDOS —`MENU_ITEM_IDS`—, no un
// repeater: sus RUTAS son ESTRUCTURA (como `HERO_HREFS`), sólo la ETIQUETA de cada uno es dato
// (patrón `ctaPrimarioLabel`: requerido, vacío → el literal de hoy). `ocultable:false` — el menú
// entero no se apaga; cada ítem individual sigue gateado por `paginas.*.visible`, SIN CAMBIO
// (§ VISIBILIDAD se queda como hoy — renombrar no es encender).
//
// LAS POSICIONES SON `content.orden` (§ orden de bandas) SPLIT EN TRES CAMPOS ESCALARES en vez de
// un array: la cáscara del editor sólo pinta campos de texto/select nativos —no hay UI de
// arrastrar-para-reordenar—, así que la MISMA idea de `orden` (una secuencia de ids, SOFT, siempre
// completa, la basura cae a la canónica) se expresa como tres selects nativos de opciones fijas
// (`MENU_ITEM_IDS`), uno por posición. `resolverOrdenMenu` (abajo) dedupe y completa exactamente
// como `resolverOrden` — gemela, no una copia literal: el dominio es distinto (`MenuItemId`, no
// `BandaId`), así que es su propia función, del mismo tamaño y forma.
export interface MenuContent {
  visible: boolean;
  labelTienda: string;
  labelSuscripciones: string;
  labelNosotros: string;
  posicion1: string;
  posicion2: string;
  posicion3: string;
  // El CTA (§ CROMO-MENU-COMO-DATO-1): AMBOS opcionales, default vacío → el CTA no se muestra — hoy
  // no hay CTA en el nav, así que el default es Nayoli byte-idéntica. `ctaDestino` es del SET
  // CERRADO `MENU_CTA_DESTINOS`; un valor fuera del set (basura, o el schema ya lo rechaza al
  // guardar) hace que `menuCtaHref` no lo renderice — preferir callar a un link roto.
  ctaLabel: string;
  ctaDestino: string;
  // El BADGE de cosecha (§ CORTE-BADGE-COSECHA-EN-MENU-1) — MUDADO de `cromo.navBadge` (que
  // envolvía el LOGO, dormido desde este slice) a ser un ATRIBUTO de UN ítem del menú, como el
  // `.nav-item .badge` del prototipo (`index.html:27-32`, junto al PRIMER `.nav-item`, no al
  // `.wordmark`). `badgeItem` es del SET CERRADO `MENU_ITEM_IDS` (o `''` = ningún ítem elegido);
  // `badgeTexto` es el texto libre del badge. AMBOS 'opcional' en `REGISTRY.menu.campos`, default
  // vacío → sin badge, mismo patrón que `ctaLabel`/`ctaDestino` — byte-idéntico sin fila.
  // `itemsDeMenu` (abajo) lo resuelve en el ítem cuyo id coincide con `badgeItem`; un `badgeItem`
  // que apunte a un ítem OCULTO (gateado por `paginas.*.visible`) o a un id fuera del set
  // simplemente no encuentra dónde mostrarse — preferir callar, mismo criterio que `menuCtaHref`.
  //
  // EN EL TIPO SON `?` (a diferencia de `ctaLabel`/`ctaDestino`, requeridos): son ADITIVOS sobre
  // una interfaz que ya tenía un literal armado a mano fuera de `touches:` de este slice
  // (`MENU_HOY: Omit<MenuContent, 'visible'>`, `lib/config/menu-como-dato.test.ts`) — hacerlos
  // requeridos habría roto ese archivo sin poder tocarlo. La opcionalidad es sólo del TIPO: en
  // RUNTIME `content.menu` siempre los trae resueltos a `''` vía `REGISTRY.menu.campos` +
  // `resolverSiteContent` (el mismo mecanismo que ya resuelve `ctaLabel`/`ctaDestino`), nunca
  // `undefined`.
  badgeItem?: string;
  badgeTexto?: string;
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
  // LOS DOS EJES ADITIVOS (§ TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1, `EjesPaleta` en
  // `palette-derive.ts`). `null` = el comportamiento de HOY (texto/acento-texto nacen del acento;
  // la acción primaria pinta con `tostado`) — NINGÚN escritor real los pone hoy: no hay campo en
  // `paletaEditableSchema` ni en el editor del panel, así que para todo tenant existente y para
  // Nayoli quedan SIEMPRE `null`. Sólo `mergePresetEnContent` (`themes.ts`) los escribe, con el
  // valor del `PresetTema` aplicado — y de los 6 presets del catálogo, sólo CORTE los declara.
  origenTexto: OrigenTexto | null;
  origenAccion: OrigenAccion | null;
  // LA ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1, `lib/config/escala-display.ts`). `null` = el
  // comportamiento de HOY, byte a byte (cada titular de display sigue rindiendo su clase Tailwind
  // fija de siempre — 12 componentes distintos, ni una base compartida entre ellos, § el docstring
  // de `escala-display.ts` sobre por qué esto NO es una variable CSS `:root` con un solo default).
  // MISMA familia aditiva que `origenTexto`/`origenAccion`: sólo `mergePresetEnContent` (`themes.ts`)
  // lo escribe, con el valor del `PresetTema` aplicado — de los 6 presets del catálogo, sólo CORTE
  // declara `'amplia'`.
  escalaDisplay: ClaveEscalaDisplay | null;
}

// META de CROMO (§ CROMO-NAV-FOOTER-TEMATIZABLE-1): los ejes de CHROME del nav/footer que hoy
// DERIVAN de `tratamientoNav`/el token de siempre, pero que un preset puede declarar distinto —
// misma familia ADITIVA que `origenTexto`/`origenAccion` (arriba): AUSENTE/`false`/`''` = el
// comportamiento de HOY, byte a byte. Va en su PROPIA meta, NO dentro de `tema`, a propósito:
// `guardarTemaBorrador`/`paletaEditableSchema` (`site-content-write.ts`/`palette-schema.ts` — los
// DOS fuera de `touches` de este slice) escriben `borrador.tema` con SÓLO 5 claves
// (fondo/tinta/acento/fuentePar/forma) y al PUBLICAR reemplazan `content.tema` ENTERO — si estos
// tres ejes vivieran ahí, el día que un operador guarde un color/fuente desde el panel de un
// tenant con preset CORTE, publicar el tema los resetearía en silencio a `false`/`''`. Como meta
// APARTE (nunca tocada por ese flujo), quedan seguros — dominio CERRADO (3 claves fijas), como
// `paginas`, no abierto como `esquemas`.
export interface CromoContent {
  // ¿El estado SÓLIDO del nav (al scrollear, o cuando la banda sobre la que flota no admite
  // transparencia) es `--sf-tinta` en vez de la tarjeta clara de siempre? (§ CORTE-NAV-TRANSPARENTE-
  // HERO-1, resemantizado — antes decía "banda SÓLIDA SIEMPRE, nunca transparente-flotante": esa
  // lectura medía mal el prototipo, cuyo `.site-header` SÍ flota transparente sobre el hero y sólo
  // cae a `--surface-inverse` al scrollear, § `.is-solid`, `css/app.css:172-191`). El floating en sí
  // lo sigue decidiendo `tratamientoNav` (§ esquema-style.ts) para CUALQUIER valor de este campo —
  // `navTinta` sólo cambia el COLOR del estado sólido. `false` = el `tratamientoNav` de HOY,
  // byte-idéntico. Sólo `mergePresetEnContent` (`themes.ts`) lo escribe, con `preset.navTinta`; de
  // los 6 presets del catálogo, sólo CORTE lo declara `true`.
  navTinta: boolean;
  // ¿El nav exhibe `SiteSetting.tagline` bajo el nombre (el sub-encabezado del wordmark, como el
  // `<small>` del prototipo)? `false` = HOY: el nav no muestra sub-encabezado (byte-idéntico) — el
  // FOOTER ya exhibe el tagline SIEMPRE, sin gate (`StoreFooter.tsx`, stacked), y este eje no lo
  // toca. Sólo `mergePresetEnContent` lo escribe.
  navSubtitulo: boolean;
  // El texto del badge junto al wordmark del nav («Cosecha 2026» en el prototipo, junto a su
  // primer `nav-item`). Vacío = no se renderiza (byte-idéntico). ES DATO DEL TENANT, no un año
  // horneado en el componente que lo pinta: CORTE lo declara como su valor de MUESTRARIO (medido
  // contra el prototipo); un tenant real cambiaría el texto por el suyo el día que este eje sea
  // editable desde el panel — hoy, como el resto de esta meta, sólo lo escribe el preset.
  navBadge: string;
}

// META de VOLVER ARRIBA (§ CROMO-VOLVER-ARRIBA-1) — GEMELA de `CromoContent` en INTENCIÓN (chrome
// del storefront que un preset puede encender, AUSENTE/`false` = el comportamiento de HOY, byte a
// byte) pero NO fusionada en `CromoContent`, a propósito: `cromo` ya es un dominio CERRADO de 3
// claves con un contrato EXHAUSTIVO afirmado por `cromo-tematizable.test.ts` (fuera de `touches` de
// este slice — no se le agrega una 4ª clave a mitad de tanda). Y hay una razón de FONDO, no sólo de
// alcance: `navTinta`/`navSubtitulo`/`navBadge` AJUSTAN un chrome que YA está SIEMPRE montado (el
// nav); esto decide si un COMPONENTE ENTERO se monta (`BackToTop.tsx`) — la misma distinción que ya
// separa `bandaOrigenVisible`/`bandaMarquesinaVisible` (encienden una banda ENTERA) de `navTinta`
// (ajusta una que ya existe). No puede vivir DENTRO de una sección existente como esos dos bandaX,
// porque "volver arriba" no es una banda del home (sin entrada en REGISTRY, sin competir por
// posición en `orden`) — así que, como `bandaOrigenVisible`, necesita su propio lugar; a diferencia
// de esos dos, ese lugar es una meta nueva, no un campo `visible` de una sección ya declarada.
export interface VolverArribaContent {
  // ¿Se monta el botón flotante "volver arriba" (gemelo del `.to-top` del prototipo,
  // `docs/prototipos/cafeone/css/app.css:340-353`)? `false` = HOY: el storefront no tiene este
  // chrome — `BackToTop.tsx` (`components/storefront/`) rinde `null`, byte-idéntico. Sólo
  // `mergePresetEnContent` (`themes.ts`) lo escribe, con `preset.volverArribaVisible`; de los 6
  // presets del catálogo, sólo CORTE lo declara `true`.
  visible: boolean;
}

// META de RIEL SOCIAL (§ CROMO-RIEL-SOCIAL-1) — MISMA forma y MISMO porqué que `VolverArribaContent`
// (arriba): chrome que un preset puede encender, AUSENTE/`false` = el comportamiento de HOY, byte a
// byte (el storefront no tiene riel social — sólo links en el footer), y NO fusionada en `cromo`
// (dominio CERRADO de 3 claves con contrato EXHAUSTIVO afirmado por `cromo-tematizable.test.ts`,
// fuera de `touches:` de este slice) ni en `VolverArribaContent` (dominio cerrado de 1 clave con SU
// PROPIO contrato, gemelo de `cromo` en forma — sumarle una 2ª clave lo convertiría en la meta
// compartida que `VolverArribaContent` explícitamente se negó a ser). Decide si un COMPONENTE ENTERO
// se monta (`RielSocial.tsx`), la misma naturaleza que `volverArriba`, no un ajuste de un chrome ya
// montado — así que necesita su propio lugar, meta nueva, no un campo de otra meta ya declarada.
export interface RielSocialContent {
  // ¿Se monta el riel social fijo a la izquierda (gemelo del `.rail` del prototipo,
  // `docs/prototipos/cafeone/css/app.css:326-338`)? `false` = HOY: el storefront no tiene este
  // chrome — `RielSocial.tsx` (`components/storefront/`) rinde `null`, byte-idéntico. Sólo
  // `mergePresetEnContent` (`themes.ts`) lo escribe, con `preset.rielSocialVisible`; de los 6
  // presets del catálogo, sólo CORTE lo declara `true`. Los DOS links del riel (instagram/whatsapp)
  // NO son parte de esta meta — salen de `SiteSetting` (la MISMA fuente única que ya usa
  // `StoreFooter`), cada uno oculto cuando su campo está vacío; esta meta sólo decide si el RIEL
  // como composición existe, no qué contiene.
  visible: boolean;
}

// META de TRATAMIENTO TIPOGRÁFICO DEL NAV (§ CROMO-NAV-TRATAMIENTO-1) — MISMA forma y MISMO porqué
// que `VolverArribaContent`/`RielSocialContent` (arriba): AUSENTE/`false` = el comportamiento de
// HOY, byte a byte. NO fusionada en `CromoContent` a pesar de ser, en NATURALEZA, la misma familia
// que `navTinta`/`navSubtitulo`/`navBadge` —AJUSTA un chrome que YA está SIEMPRE montado (el nav),
// no decide si un componente entero se monta (a diferencia de `volverArriba`/`rielSocial`)—: se
// midió la consecuencia de sumarle una 4ª clave a `cromo` contra el árbol completo, no sólo contra
// este archivo, y `lib/config/cromo-tematizable.test.ts` (FUERA de `touches:` de este slice) afirma
// la forma EXHAUSTIVA de `cromo` con `assert.deepEqual` contra literales de 3 claves —en
// COMPILACIÓN (falta la propiedad del tipo en `CROMO_HOY: CromoContent = {...}`) antes incluso de
// llegar a un `assert` en runtime—. Ampliar ese archivo para que acepte una 4ª clave habría sido la
// ampliación de alcance no autorizada que el protocolo de este slice prohíbe hacer por cuenta
// propia (mismo razonamiento, palabra por palabra, que ya cerró `CROMO-VOLVER-ARRIBA-1` y
// `CROMO-RIEL-SOCIAL-1` sobre esta MISMA restricción — ver sus asientos en `DECISIONS.md`). Por eso
// esta meta es NUEVA y PROPIA, no un 4º campo de `cromo`, aunque conceptualmente "quisiera" vivir
// ahí: es una decisión de ALCANCE, no de dominio.
//
// NO CONFUNDIR con la función `tratamientoNav` (`lib/config/esquema-style.ts`): esa decide si el
// nav FLOTA transparente sobre la banda y de qué color va su texto (un eje de POSICIÓN/CONTRASTE,
// calculado en cada render). Esto es un eje TIPOGRÁFICO declarado por el PRESET —mayúscula +
// tracking del prototipo + un peso, sobre la MISMA sans del par (§ `PresetTema.navTratamientoActivo`,
// `themes.ts`)— que no interactúa con aquélla.
export interface NavTratamientoContent {
  // ¿Los links del nav llevan el tratamiento tipográfico del `.nav-link` del prototipo (mayúscula +
  // `letter-spacing:var(--tracking-nav)` = `.06em` + peso regular, MEDIDO contra
  // `docs/prototipos/cafeone/css/app.css:212-217`/`tokens.css:129` — el prototipo no declara
  // `font-weight` en `.nav-link`, así que hereda el 400/regular del `body`, § el asiento de este
  // slice)? `false` = HOY: los links del nav van `text-sm font-medium`, sin mayúscula ni tracking,
  // byte-idéntico. Sólo `mergePresetEnContent` (`themes.ts`) lo escribe, con
  // `preset.navTratamientoActivo`; de los 6 presets del catálogo, sólo CORTE lo declara `true`.
  activo: boolean;
}

// META de TRATAMIENTO DEL WORDMARK APILADO (§ CORTE-LOGO-APILADO-1) — MISMA forma y MISMO porqué que
// `NavTratamientoContent` (arriba): AUSENTE/`false` = el comportamiento de HOY, byte a byte. NO se
// fusiona con `NavTratamientoContent` a pesar de sonar a la misma familia ("tratamiento del nav"):
// `NavTratamientoContent.activo` es un eje NARROW, ya CERRADO y afirmado por
// `cromo-nav-tratamiento.test.ts` (FUERA de `touches:` de este slice) como "¿los LINKS del nav llevan
// mayúscula+tracking+peso?" — un elemento del DOM distinto (`.nav-link`), con sus PROPIOS valores
// medidos (`.06em`, sans del par). El wordmark apilado (`.wordmark`/`.wordmark small` del prototipo,
// `docs/prototipos/cafeone/css/app.css:199-207`) es OTRO elemento con SUS PROPIOS valores medidos
// (`.01em` en el nombre, `.11em` en el sub, el sub en SANS sin itálica) — reusar `activo` de
// `NavTratamientoContent` para las dos cosas habría hecho que un preset futuro que quisiera SÓLO uno
// de los dos ejes no pudiera, y habría obligado a re-redactar el docstring/test ya cerrados de ESE
// eje para que dijeran algo que no midieron. Meta NUEVA y PROPIA, no un 2º campo de `navTratamiento`.
export interface NavWordmarkContent {
  // ¿El wordmark apilado del nav (nombre + sub-encabezado, rama `subtitle` de `Logo.tsx` — el apilado
  // YA EXISTE, gateado por `cromo.navSubtitulo`; esto es sólo el ESTILO) calza el `.wordmark`/
  // `.wordmark small` del prototipo? MEDIDO contra `docs/prototipos/cafeone/css/app.css:199-207`: el
  // NOMBRE gana mayúscula + `letter-spacing:.01em` + tamaño mayor (30px, el prototipo), en la MISMA
  // fuente de título (serif) que ya usa; el SUB pasa de `font-display` itálico `--sf-tostado-5` a la
  // SANS del cuerpo (`.font-inter`, = `--font-ui` del prototipo), muted, `letter-spacing:.11em`
  // (`--tracking-eyebrow`), `margin-top:4px`, peso regular, SIN itálica. `false` = HOY: el nombre va
  // `font-display text-[22px]` sin mayúscula ni tracking, y el sub `font-display text-[11px] italic
  // text-[var(--sf-tostado-5)]` — byte-idéntico. Sólo `mergePresetEnContent` (`themes.ts`) lo
  // escribe, con `preset.navWordmarkActivo`; de los 6 presets del catálogo, sólo CORTE lo declara
  // `true`.
  activo: boolean;
}

export interface SiteContentData {
  hero: HeroContent;
  marquesina: MarquesinaContent;
  brandStory: BrandStoryContent;
  origen: OrigenContent;
  presentaciones: PresentacionesContent;
  spotlight: SpotlightContent;
  subscriptionCTA: SubscriptionCTAContent;
  testimonials: TestimonialsContent;
  nosotrosHistoria: NosotrosHistoriaContent;
  nosotrosGaleria: NosotrosGaleriaContent;
  suscripcionPlanes: SuscripcionPlanesContent;
  suscripcionPasos: SuscripcionPasosContent;
  suscripcionFaq: SuscripcionFaqContent;
  menu: MenuContent;
  paginas: PaginasContent;
  tema: TemaContent;
  cromo: CromoContent;
  volverArriba: VolverArribaContent;
  rielSocial: RielSocialContent;
  navTratamiento: NavTratamientoContent;
  navWordmark: NavWordmarkContent;
  esquemas: EsquemasContent;
  orden: OrdenContent;
  variantesBandas: VariantesBandasContent;
}

// META de esquemas (§ eje 5b, mitad B): el mapa bandaId→esquema que decide sobre QUÉ superficie
// vive cada banda del home (§ palette-derive, `derivarEsquema`). NO es una sección (no lleva
// `campos` ni la resuelve el loop) — es la PIEL POR-BANDA, gemela de `tema` (que es la piel de
// TODO el storefront) pero con un dominio de claves ABIERTO: cualquier bandaId puede tener una
// entrada, así que no hay un `defaults` fijo que enumerar (§ `resolverEsquemas`, key-agnóstico).
// Una banda AUSENTE del mapa (o con basura) = SIN OVERRIDE = su token CANÓNICO de hoy — el
// mecanismo que mantiene a Nayoli byte-idéntica sin sembrar fila (§ `--sf-banda` en `esquema-style`).
export type EsquemasContent = Record<string, ClaveEsquema>;

// META de VARIANTES DE BANDAS ESTRUCTURALES (TEMAS-P1-FEATURED-VARIANTES-1): el mapa bandaId→variante
// para bandas que NO son `SeccionKey` (`featured`, hoy la única) — GEMELA EXACTA de `EsquemasContent`
// en forma y en motivo: dominio de claves ABIERTO, sin `defaults` fijo que enumerar (§
// `resolverVariantesBandas`, key-agnóstico, abajo). Una banda AUSENTE del mapa (o con basura) = SIN
// OVERRIDE = su canónica (§ `VARIANTES_ESTRUCTURALES`) — el mismo mecanismo de byte-identidad que
// `esquemas`. La `variante` DENTRO de una SECCIÓN real (`hero.variante`, `brandStory.variante`) sigue
// viviendo donde vivía: esta meta es sólo para las bandas que no tienen una sección donde guardarla.
export type VariantesBandasContent = Record<string, string>;

// META de ORDEN (§ eje 5, parte c — el orden de las bandas del home como DATO). A diferencia de
// `esquemas` (dominio ABIERTO, cualquier bandaId), acá el dominio es CERRADO: los 9 ids de banda
// que hoy monta `app/(storefront)/page.tsx` (7 hasta § ORIGEN-BANDA-1, que sumó `origen`; 9 hasta
// § MARQUESINA-BANDA-1, que sumó `marquesina` — ver su docstring en `MarquesinaContent`, arriba,
// para el porqué de su posición 2ª, justo tras `hero`). `BANDA_IDS` es la ÚNICA lista de esos ids —
// `site-content-schema.ts` la importa para su `z.enum` en vez de declarar una segunda—, y ya está
// en el ORDEN DEFAULT de hoy, así que `[...BANDA_IDS]` sirve directo como default. Newsletter
// (`newsletter`) queda FUERA: sigue oculta/comentada en v1 (§ page.tsx) y no se renderiza, así que
// no es un id reordenable — agregarla es el día que se reactive esa sección.
export const BANDA_IDS = [
  'hero', 'marquesina', 'trustBadges', 'featured', 'brandStory', 'origen', 'presentaciones', 'subscriptionCTA', 'testimonials',
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
//                     var(--sf-tinta)      (HeroMedia.tsx, variante 'media')     → OSCURA
//   marquesina      → var(--sf-tinta)      (Marquesina.tsx)         → OSCURA (§ MARQUESINA-BANDA-1;
//                     foto de fondo velada con overlay — el mismo rol que el velo de HeroMedia.tsx)
//   brandStory      → var(--sf-tinta)      (BrandStory.tsx)         → OSCURA
//   subscriptionCTA → var(--sf-tinta-2)    (SubscriptionCTA.tsx)    → OSCURA
//   trustBadges     → var(--sf-fondo)      (TrustBadges.tsx)        → clara
//   featured        → var(--sf-fondo)      (FeaturedProducts.tsx)   → clara
//   origen          → var(--sf-fondo)      (Origen.tsx)             → clara (§ ORIGEN-BANDA-1)
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
export const BANDAS_OSCURAS: ReadonlySet<BandaId> = new Set<BandaId>(['hero', 'marquesina', 'brandStory', 'subscriptionCTA']);

/** La darkness CANÓNICA (sin esquema) de una banda, dependiente de su VARIANTE cuando la
 *  tiene. Hoy sólo el HERO: 'curtina' y 'media' (§ TEMAS-HERO-MEDIA-1) son OSCURAS (fondo
 *  `--sf-tinta`), 'ficha' es CLARA (fondo `--sf-fondo`) — atado al fallback
 *  `bg-[var(--sf-banda,<token>)]` de cada componente, como `BANDAS_OSCURAS`. El resto de las
 *  bandas no varían con la variante → `BANDAS_OSCURAS`. */
export function bandaOscuraCanonica(bandaId: BandaId, variante?: string): boolean {
  if (bandaId === 'hero') return variante !== 'ficha'; // curtina/media/ausente = oscura; ficha = clara
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
    // La canónica (§ HERO-VIDEO-COMO-DATO-1): Nayoli queda byte-idéntica — fondo por IMAGEN, sin
    // póster (un póster sin video no significa nada).
    imagenTipo: 'imagen',
    imagenPoster: '',
    // La canónica (§ eje 5, EJE-5-VARIANTES-HERO): Nayoli queda byte-idéntica a la curtina de hoy.
    variante: 'curtina',
    // Los TRES agregados (§ TEMAS-HERO-MEDIA-AGREGADOS-1): default = el hero-media de HOY, byte a
    // byte — `ctasVisibles: true` (los dos CTA de siempre), `fraseAlPie: ''` (se omite, § `campos`
    // arriba), `cueDesliza: false` (sin cue).
    ctasVisibles: true,
    fraseAlPie: '',
    cueDesliza: false,
    // Los DOS toggles nuevos (§ CORTE-HERO-TITULAR-OCULTABLE-1): default `true` = el hero de HOY
    // byte a byte, titular y subtítulo visibles.
    titularVisible: true,
    subtituloVisible: true,
  },
  // LA BANDA MARQUESINA (§ MARQUESINA-BANDA-1, ver el docstring de `MarquesinaContent` arriba).
  // NACE OFF (`visible:false`) por la MISMA razón mecánica que `origen`: `resolverOrden` completa
  // el orden de TODO tenant con TODA banda de `BANDA_IDS`, sin condición — estar en la lista no
  // alcanza para mostrarse.
  //
  // EL TEXTO ES GENÉRICO A PROPÓSITO, no el «Café fresco de San Adolfo — Huila — Colombia» del
  // prototipo (§ MARQUESINA-BANDA-CENSO-1): `mergePresetEnContent` JAMÁS escribe texto de sección,
  // así que el ÚNICO texto que CORTE podría mostrar bajo `?tema=CORTE` es ESTE default — una frase
  // de origen geográfico concreto en un default COMPARTIDO por TODO tenant sería un dato FABRICADO
  // sobre ese negocio, la misma familia que el rating fabricado que se borró (§ El RATING fabricado
  // se BORRÓ, CLAUDE.md). El test `DEFAULTS: ningún campo de TEXTO menciona café…` (§ CONTENIDO-
  // NEUTRALIZAR-1) camina TODO `DEFAULTS` sin excepción por sección, así que un texto café-shape acá
  // lo haría fallar igual que en cualquier otra.
  //
  // `imagen` reusa un asset estático existente (`brandStory.imagen4`) — la banda nace OFF, así que
  // no hay urgencia de una foto propia (mismo criterio que `origen.imagen1/2` reusando imágenes de
  // brandStory). `productoSlug` vacío: sin pin, la tarjeta flotante simplemente no se muestra
  // (§ `productoSpotlight`, el MISMO mecanismo que ya resuelve el pin de `spotlight`).
  marquesina: {
    visible: false,
    texto: 'Calidad que se nota en cada entrega',
    imagen: '/images/historia-4-v1.jpg',
    productoSlug: '',
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
  // LA BANDA ORIGEN (§ ORIGEN-BANDA-1, ver el docstring de `OrigenContent` arriba). NACE OFF
  // (`visible:false`) — igual que spotlight nació OFF mientras estuvo fuera de `BANDA_IDS`, por la
  // MISMA razón mecánica: `resolverOrden` completa el orden de TODO tenant con TODA banda de
  // `BANDA_IDS`, así que estar en la lista no alcanza para mostrarse. Sin este `false`, Nayoli (y
  // cualquier tenant sin fila propia) vería la banda aparecer sola.
  //
  // EL COPY ES GENÉRICO A PROPÓSITO —igual que `hero`/`brandStory`/`presentaciones` tras
  // CONTENIDO-NEUTRALIZAR-N—, aunque el prototipo que motivó esta banda (`docs/prototipos/cafeone/`,
  // § ORIGEN-BANDA-CENSO-1) sea 100% café (Altitud/Variedad/Proceso/Cosecha, msnm, hectáreas). El
  // test `DEFAULTS: ningún campo de TEXTO menciona café…` (abajo en este archivo, § CONTENIDO-
  // NEUTRALIZAR-1) camina TODO `DEFAULTS` sin excepciones por sección, así que un texto café-shape
  // acá lo haría fallar igual que en cualquier otra — no hay exención para "banda nueva".
  //
  // LOS VALORES de los 4 pares dato y los 3 stats nacen VACÍOS, no genéricos-con-número-inventado, y
  // es la MISMA razón que ya vacía `precio` en `SuscripcionPlanesContent`: `mergePresetEnContent`
  // JAMÁS escribe texto de sección (sólo `visible`), así que el ÚNICO valor que CORTE podría mostrar
  // bajo `?tema=CORTE` es ESTE default — y una cifra («52 años», «1.600 msnm») en un default
  // COMPARTIDO por TODO tenant sería un dato fabricado sobre ESE negocio, la misma familia que el
  // rating fabricado que se borró (§ El RATING fabricado se BORRÓ, CLAUDE.md). Los LABELS sí llevan
  // default —son categorías, no una afirmación verificable— y las VALORES vacíos se OMITEN en el
  // render (`Origen.tsx`), como cualquier campo opcional vacío del sistema.
  origen: {
    visible: false,
    eyebrow: 'El origen',
    titulo: 'Detrás de cada producto hay un origen real',
    lede:
      'Cada producto que ofrecemos nace en un lugar concreto, con personas que lo hacen posible. Contamos esa historia para que sepas exactamente de dónde viene lo que te llega.',
    // Reusa assets estáticos existentes (§ brandStory.imagen2/imagen3) en vez de introducir un asset
    // nuevo: la banda nace OFF, así que no hay urgencia de una foto propia.
    imagen1: '/images/historia-2-v1.jpg',
    imagen2: '/images/historia-3-v1.jpg',
    dato1Label: 'Ubicación', dato1Valor: '',
    dato2Label: 'Selección', dato2Valor: '',
    dato3Label: 'Cuidado', dato3Valor: '',
    dato4Label: 'Disponibilidad', dato4Valor: '',
    statNumero1: '', statEtiqueta1: '',
    statNumero2: '', statEtiqueta2: '',
    statNumero3: '', statEtiqueta3: '',
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
  // La banda SPOTLIGHT (§ SPOTLIGHT-BANDA-1, ver el docstring de `SpotlightContent`). NACE OFF
  // (`visible:false`) — la ÚNICA sección ocultable con este default — porque `spotlight` TODAVÍA
  // no es miembro de `BANDA_IDS` (§ el bloqueo medido en DECISIONS.md); el día que lo sea, nacer
  // OFF es lo único que evita que su sola presencia en el `orden` resuelto encienda la banda para
  // CUALQUIER tenant que no la pidió, Nayoli incluida (`resolverOrden` completa siempre con TODA
  // banda conocida, sin excepción). Sin pin (`productoSlug`/`otroTamanoSlug` vacíos): sin efecto
  // mientras la sección esté OFF, y el día que se encienda cae al PRIMER producto del catálogo
  // (§ `productoSpotlight`).
  //
  // ESTE DEFAULT NO SE TOCÓ EN SPOTLIGHT-CABLEADO-HOME-1 (§ VARIANTES_ESTRUCTURALES, arriba), aunque
  // esa tanda conecta `spotlight` como variante de `featured` — sigue sin sumarse a `BANDA_IDS`, así
  // que el motivo mecánico de arriba sigue vigente sin cambios, y Nayoli (variante 'cuadricula') no
  // monta `<Spotlight>` nunca, con este `visible` en cualquier valor. Lo que hace que la VARIANTE se
  // vea de verdad es `mergePresetEnContent` (`themes.ts`): fuerza `visible:true` SÓLO cuando el
  // preset pide `featured·spotlight` — un tenant que use la variante no puede quedar con la banda
  // encendida-por-elección-de-composición pero apagada-por-el-campo-de-abajo.
  spotlight: {
    visible: false,
    eyebrow: '',
    titulo: '',
    badge: '',
    productoSlug: '',
    otroTamanoSlug: '',
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
    // La canónica (TEMAS-SUBSCRIPTIONCTA-LINEA-1, § eje 5e): Nayoli queda byte-idéntica al bloque de hoy.
    variante: 'bloque',
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
  // El MENÚ por defecto: los TRES labels y el orden de HOY (`StoreNav.tsx`, antes de este slice) —
  // tienda → suscripciones → nosotros—, el CTA APAGADO (los dos campos vacíos), y el BADGE APAGADO
  // (§ CORTE-BADGE-COSECHA-EN-MENU-1, los dos campos vacíos — ningún ítem lleva badge). Byte-idéntico
  // sin fila (§ CROMO-MENU-COMO-DATO-1, la invariante del slice).
  menu: {
    visible: true,
    labelTienda: 'Tienda',
    labelSuscripciones: 'Suscripciones',
    labelNosotros: 'Nosotros',
    posicion1: 'tienda',
    posicion2: 'suscripciones',
    posicion3: 'nosotros',
    ctaLabel: '',
    ctaDestino: '',
    badgeItem: '',
    badgeTexto: '',
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
    origenTexto: null, // texto/texto-suave/acento-texto nacen del acento — el default byte-idéntico
    origenAccion: null, // la acción primaria pinta con `tostado` — el default byte-idéntico
    escalaDisplay: null, // cada titular de display sigue su clase Tailwind de hoy — byte-idéntico
  },
  // CROMO por defecto (§ CROMO-NAV-FOOTER-TEMATIZABLE-1): los 3 ejes en su valor de HOY —el nav
  // deriva de `tratamientoNav`, sin sub-encabezado, sin badge— → byte-idéntico sin depender de una
  // fila. Sólo un preset (`mergePresetEnContent`) los escribe distinto.
  cromo: {
    navTinta: false,
    navSubtitulo: false,
    navBadge: '',
  },
  // VOLVER ARRIBA por defecto (§ CROMO-VOLVER-ARRIBA-1): sin botón flotante → byte-idéntico sin
  // depender de una fila (`BackToTop.tsx` rinde `null`). Sólo CORTE lo enciende, vía
  // `mergePresetEnContent`.
  volverArriba: {
    visible: false,
  },
  // RIEL SOCIAL por defecto (§ CROMO-RIEL-SOCIAL-1): sin riel → byte-idéntico sin depender de una
  // fila (`RielSocial.tsx` rinde `null`). Sólo CORTE lo enciende, vía `mergePresetEnContent`.
  rielSocial: {
    visible: false,
  },
  // TRATAMIENTO DEL NAV por defecto (§ CROMO-NAV-TRATAMIENTO-1): sin mayúscula/tracking → el
  // `text-sm font-medium` de HOY, byte-idéntico. Sólo CORTE lo enciende, vía `mergePresetEnContent`.
  navTratamiento: {
    activo: false,
  },
  // TRATAMIENTO DEL WORDMARK APILADO por defecto (§ CORTE-LOGO-APILADO-1): sin mayúscula/tracking en
  // el nombre y sub itálico `--sf-tostado-5` de HOY, byte-idéntico. Sólo CORTE lo enciende, vía
  // `mergePresetEnContent`.
  navWordmark: {
    activo: false,
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
  // VARIANTES DE BANDAS ESTRUCTURALES por defecto: el mapa nace VACÍO, gemelo de `esquemas` arriba.
  // Ninguna banda estructural tiene entrada → `featured` cae a su canónica ('cuadricula',
  // § VARIANTES_ESTRUCTURALES) → byte-idéntico. `FeaturedProducts.tsx` SÍ lee esta meta desde
  // TEMAS-FEATURED-GRILLA-1 (es el dispatcher entre `cuadricula`/`grilla`/`spotlight`, la última
  // sumada en SPOTLIGHT-CABLEADO-HOME-1); antes de ese primer slice el único consumidor era
  // `themes.ts` (`mergePresetEnContent`), que sigue siendo el sitio donde un preset escribe sin
  // crear una clave `content.featured` huérfana.
  variantesBandas: {},
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
  /** ESCALARES de sección ADICIONALES, clampados con el MISMO `resolverVariante` que `variantes`
   *  (§ HERO-VIDEO-COMO-DATO-1) — pero por NOMBRE DE CAMPO en vez de la única ranura fija
   *  `sec.variante`. Es lo que permite una SEGUNDA (o tercera) propiedad clampada por sección sin
   *  un `if (key === 'hero')` hardcodeado en el loop del resolver: `hero.escalares.imagenTipo`
   *  clampa igual que `hero.variantes` clampa `variante`, sólo que escribe `sec.imagenTipo`. NO
   *  reemplaza a `variantes` —esa ranura sigue siendo la composición de la sección—; esto es para
   *  escalares nuevos que no son la composición. */
  escalares?: Record<string, VariantesDef>;
  /** Campos BOOLEANOS de sección ADICIONALES a `visible` (§ TEMAS-HERO-MEDIA-AGREGADOS-1). MISMO
   *  mecanismo que `visible` (abajo, en `storedSec.visible`): sólo se sobreescriben con un
   *  booleano EXPLÍCITO guardado — ausente, `null` o basura → el default de la sección. Gemelo de
   *  `escalares`, pero para un flag true/false en vez de un set cerrado de strings: sin esto, cada
   *  nuevo campo booleano de sección exigiría un `if (key === 'hero')` hardcodeado en el loop, el
   *  mismo hardcoding que `escalares` existe para evitar del lado de los strings clampados. */
  booleanos?: string[];
  campos: Record<string, CampoTipo>;
  /** Nombres de los campos que son IMÁGENES (blobs). Los lee el borrado de blobs reemplazados
   *  (`imagenesDe`), NO el resolver. Para un repeater la imagen vive en cada item. */
  imagenes?: string[];
}

// Las claves de SECCIÓN (todo `SiteContentData` menos las META `paginas`, `tema`, `cromo`,
// `volverArriba`, `rielSocial`, `navTratamiento`, `navWordmark`, `esquemas`, `orden` y
// `variantesBandas`, que no son secciones). El REGISTRY las cubre a todas; las diez metas quedan
// fuera a propósito —cada una se resuelve aparte del loop de secciones.
export type SeccionKey = Exclude<keyof SiteContentData, 'paginas' | 'tema' | 'cromo' | 'volverArriba' | 'rielSocial' | 'navTratamiento' | 'navWordmark' | 'esquemas' | 'orden' | 'variantesBandas'>;

export const REGISTRY: Record<SeccionKey, SeccionDef> = {
  hero: {
    label: 'Portada',
    ocultable: false,
    // `imagenPoster` ENTRA acá (§ HERO-VIDEO-COMO-DATO-1) — es el SEGUNDO blob del hero, y si no se
    // nombrara acá el borrado de blobs (`imagenesDe`, site-content-blobs.ts) nunca lo vería: el
    // póster de un video reemplazado quedaría HUÉRFANO en el storage para siempre.
    imagenes: ['imagen', 'imagenPoster'],
    // VARIANTES DE COMPOSICIÓN (§ eje 5, EJE-5-VARIANTES-HERO): 'curtina' es la canónica —el hero de
    // HOY, verbatim—; 'ficha' es la bi-tonal (tipografía en tinta sobre crema, foto a sangre a la
    // derecha, sin degradado); 'media' (§ TEMAS-HERO-MEDIA-1) es la TERCERA — la media (imagen o
    // video) llena la sección a opacidad plena, SIN el velo oscuro que atenúa a la curtina, y el
    // texto vive en una TARJETA (`--sf-tarjeta`/`--sf-sobre-tarjeta`) que flota sobre ella, en vez de
    // apoyarse en los tokens `--sf-sobre-banda` (pensados para un fondo de banda aproximadamente
    // plano — el que la curtina logra atenuando la foto al 40%, no el que esta variante quiere). Un
    // degradado angosto arriba (mismo tono `--sf-tinta`/60 que ya usa la curtina en ese mismo punto,
    // § HeroMedia.tsx) mantiene el nav legible sin necesitar `noUniformes`: la sección sigue siendo
    // UN solo plano de media, no partida en dos zonas de color como la ficha.
    // Segunda sección con `variantes`, tras `presentaciones` (§ eje 5e).
    // `noUniformes: ['ficha']` (§ EJE-5-NAV-UNIFORME): la ficha es BI-TONAL —crema a la izquierda,
    // foto oscura a la derecha— y ningún color de texto único del nav se lee sobre las dos mitades;
    // el nav transparente-flotante cae a SÓLIDO sobre ella (§ `tratamientoNav`, esquema-style.ts).
    // 'media' NO entra acá: es uniforme (un solo plano de media), así que el nav sigue flotando
    // transparente — su legibilidad la garantiza el degradado superior, no el fallback a sólido.
    variantes: { claves: ['curtina', 'ficha', 'media'], canonica: 'curtina', noUniformes: ['ficha'] },
    // ESCALARES (§ HERO-VIDEO-COMO-DATO-1): `imagenTipo` es el SEGUNDO escalar clampado de esta
    // sección (el primero es `variante`, arriba) — MISMO mecanismo (`resolverVariante`), otra
    // ranura. 'imagen' es la canónica: Nayoli queda byte-idéntica sin fila.
    escalares: { imagenTipo: { claves: ['imagen', 'video'], canonica: 'imagen' } },
    // BOOLEANOS (§ TEMAS-HERO-MEDIA-AGREGADOS-1, ampliado en § CORTE-HERO-TITULAR-OCULTABLE-1): los
    // CUATRO agregados de mecánica true/false del hero-media del prototipo — `ctasVisibles` (apaga
    // los dos CTA a la vez), `cueDesliza` (el indicador de scroll animado), `titularVisible` (el
    // bloque `titulo`+`tituloEnfasis`) y `subtituloVisible` (el `subtitulo`), estos dos últimos cada
    // uno su propio apagador. El quinto agregado (`fraseAlPie`) es un `campos` normal, abajo.
    booleanos: ['ctasVisibles', 'cueDesliza', 'titularVisible', 'subtituloVisible'],
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
      tituloEnfasis: 'opcional',
      subtitulo: 'requerido',
      ctaPrimarioLabel: 'requerido',
      ctaSecundarioLabel: 'opcional',
      imagen: 'requerido',
      // OPCIONAL, no requerido: el default es '' (sin video no hay póster que mostrar), y un hero
      // de IMAGEN no necesita nunca este campo. La OBLIGATORIEDAD condicional (si hay video, hay
      // póster) es del `.refine()` de `heroEditableSchema`, no de este mapa requerido/opcional —el
      // mapa no puede expresar "requerido SI OTRO CAMPO vale X".
      imagenPoster: 'opcional',
      // OPCIONAL (§ TEMAS-HERO-MEDIA-AGREGADOS-1): vacío → SE OMITE, no cae a ningún texto de
      // relleno — el `.hero-caption` del prototipo es dato del tenant, nunca un default inventado
      // (misma regla que `eyebrow`/`tituloEnfasis`, § "la frontera fina de defaults-como-fallback").
      fraseAlPie: 'opcional',
    },
  },
  // LA BANDA MARQUESINA (§ MARQUESINA-BANDA-1, ver el docstring de `MarquesinaContent` arriba).
  // `ocultable: true`, sin `variantes` (una sola composición). `productoSlug` es OPCIONAL —sin pin
  // la tarjeta flotante no se muestra, el texto del loop no depende de ella—.
  marquesina: {
    label: 'Marquesina',
    ocultable: true,
    imagenes: ['imagen'],
    campos: {
      texto: 'requerido',
      imagen: 'requerido',
      productoSlug: 'opcional',
    },
  },
  brandStory: {
    label: 'Historia',
    ocultable: true,
    imagenes: ['imagen1', 'imagen2', 'imagen3', 'imagen4'],
    // VARIANTES DE COMPOSICIÓN (§ eje 5e, TEMAS-P2-BRANDSTORY-1) — 'columnas' es la canónica —el
    // layout de HOY, verbatim (texto a un lado, collage 2×2 al otro, `grid-cols-1 lg:grid-cols-2`)—.
    // 'centrada' (§ CORTE-BRANDSTORY-COLLAGE-1) es la SEGUNDA clave — la que abrió el slot con UNA
    // sola clave: eyebrow+título centrados, el collage de las mismas 4 imágenes A LO ANCHO debajo, y
    // el párrafo cerrando abajo, medida contra `docs/prototipos/cafeone/` (§ su comentario de
    // cabecera en `BrandStoryCentrada.tsx` — qué piezas del prototipo esta variante NO expresa).
    // `BrandStory.tsx` ganó su dispatcher en el mismo slice.
    // `noUniformes`: NO en NINGUNA de las dos — la banda es de un solo tono sólido
    // (`bg-[var(--sf-banda,var(--sf-tinta))]`) en las dos composiciones, nunca bi-tonal.
    variantes: { claves: ['columnas', 'centrada'], canonica: 'columnas' },
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
  // LA BANDA ORIGEN (§ ORIGEN-BANDA-1, ver el docstring de `OrigenContent` arriba). `ocultable:
  // true`, sin `variantes` (una sola composición: grid de 2 fotos + copy + la lista de datos + los
  // 3 contadores). Los 4 pares dato y los 3 stats son cardinalidad FIJA —mismo patrón que
  // `suscripcionPasos` (slots fijos, campos planos)—, pero el LABEL y el VALOR de cada par NO
  // comparten obligatoriedad: los LABELS son requeridos (categorías, no una afirmación verificable,
  // § el docstring de `OrigenContent` para el porqué completo); los VALORES —y los dos campos de
  // cada stat— son OPCIONALES, vacío se OMITE en el render (criterio análogo al de las tarjetas 3-4
  // de Presentaciones, sólo que acá el gate es "tiene valor", no "título O imagen").
  origen: {
    label: 'Origen',
    ocultable: true,
    imagenes: ['imagen1', 'imagen2'],
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
      lede: 'requerido',
      imagen1: 'requerido',
      imagen2: 'requerido',
      dato1Label: 'requerido', dato1Valor: 'opcional',
      dato2Label: 'requerido', dato2Valor: 'opcional',
      dato3Label: 'requerido', dato3Valor: 'opcional',
      dato4Label: 'requerido', dato4Valor: 'opcional',
      statNumero1: 'opcional', statEtiqueta1: 'opcional',
      statNumero2: 'opcional', statEtiqueta2: 'opcional',
      statNumero3: 'opcional', statEtiqueta3: 'opcional',
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
    // verbatim—; 'indice' es la de filas numeradas; 'riel' (§ CORTE-PRESENTACIONES-RIEL-1) es la
    // TERCERA — tarjetas en un riel horizontal con desplazamiento nativo y controles, medida contra
    // el prototipo (`GrindChooserRiel.tsx`).
    variantes: { claves: ['mosaico', 'indice', 'riel'], canonica: 'mosaico' },
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
  // La banda SPOTLIGHT (§ SPOTLIGHT-BANDA-1, ver el docstring de `SpotlightContent`). `ocultable:
  // true`, sin `variantes` (una sola composición — ficha del producto pineado + selector de
  // molienda + notas de cata + carrito, § Spotlight.tsx) y sin `imagenes`: el contenido visual
  // (la portada) se LEE del `Product` pineado en cada render, nunca se sube acá — el pin es
  // puntero, no copia. Los cuatro campos son EDITORIALES puros; `productoSlug`/`otroTamanoSlug`
  // son los DOS punteros (§ el destino es DATO, igual que `categoria1/2` de Presentaciones).
  spotlight: {
    label: 'Destacado',
    ocultable: true,
    campos: {
      eyebrow: 'opcional',
      titulo: 'opcional',
      badge: 'opcional',
      productoSlug: 'opcional',
      otroTamanoSlug: 'opcional',
    },
  },
  subscriptionCTA: {
    label: 'Suscripción',
    ocultable: true,
    // VARIANTES DE COMPOSICIÓN (TEMAS-SUBSCRIPTIONCTA-LINEA-1, § eje 5e): 'bloque' es la canónica —el
    // layout de HOY, verbatim (§ SubscriptionCTABloque)—; 'linea' es la nueva (franja horizontal
    // condensada, § SubscriptionCTALinea). Cuarta sección con `variantes`, tras hero/brandStory/
    // presentaciones. `noUniformes`: NO — las dos composiciones se apoyan en el fondo SÓLIDO de la
    // banda (`bg-[var(--sf-banda,var(--sf-tinta-2))]`), ninguna es bi-tonal.
    variantes: { claves: ['bloque', 'linea'], canonica: 'bloque' },
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
  // El MENÚ del nav (§ CROMO-MENU-COMO-DATO-1). `ocultable:false` — como el hero, el menú no se
  // apaga entero; renombrar/reordenar no es lo mismo que encender/apagar. Sin `imagenes` (no lleva
  // ninguna). Las posiciones, el CTA y el BADGE (§ CORTE-BADGE-COSECHA-EN-MENU-1) son
  // 'requerido'/'opcional' STRINGS PLANOS a propósito —el resolver genérico no valida pertenencia a
  // un set cerrado, sólo default-vs-omit—; el set cerrado lo impone el SCHEMA (§ site-content-
  // schema.ts, `menuEditableSchema`) al escribir, y el RENDER (`resolverOrdenMenu`/`menuCtaHref`/
  // `itemsDeMenu`, abajo) lo vuelve a filtrar SOFT al leer, para que un dato corrupto por otra vía
  // (un `UPDATE` a mano, una fila vieja) no produzca un link roto ni un badge huérfano.
  menu: {
    label: 'Menú',
    ocultable: false,
    campos: {
      labelTienda: 'requerido',
      labelSuscripciones: 'requerido',
      labelNosotros: 'requerido',
      posicion1: 'requerido',
      posicion2: 'requerido',
      posicion3: 'requerido',
      ctaLabel: 'opcional',
      ctaDestino: 'opcional',
      badgeItem: 'opcional',
      badgeTexto: 'opcional',
    },
  },
};

// VARIANTES DE BANDAS ESTRUCTURALES (TEMAS-P1-FEATURED-VARIANTES-1): el gemelo de `SeccionDef.
// variantes` para bandas que NO son `SeccionKey` —`featured`/`trustBadges`, sin entrada en
// `SiteContentData` ni en el REGISTRY (§ `bandaUniforme`, arriba)—. Sin esta tabla, un preset que
// pide `featured·X` no tiene DÓNDE declarar la variante: `validarPreset` (themes.ts) rechazaba
// TODO pedido de featured con "no declara variantes en el REGISTRY", sin distinguir "la composición
// pedida no existe" de "la banda no tiene slot" — el mismo defecto que `TEMAS-P2-BRANDSTORY-1` ya
// cerró del lado de las secciones. Medido contra `themes.ts` antes de este slice
// (`TEMAS-P1-BANDAS-ESTRUCTURALES-FORMA-1`): las CINCO entregas del diseño piden una variante de
// `featured` y ninguna tiene dónde resolverse.
//
// SÓLO `featured` HOY. `trustBadges` se deja AFUERA A PROPÓSITO (decisión del owner): ningún preset
// del catálogo (§ themes.ts, PRESETS) pide una variante de `trustBadges` —vive sólo en los mapas de
// `esquemas`/`orden`, nunca en `variantes`—, así que declarar un slot que nadie consume sería
// CAPACIDAD MUERTA: la simetría con `featured` no es razón para abrirlo. Cuando un theme lo pida,
// entra con su variante real en el mismo commit que la construye.
//
// `featured` canónica = 'cuadricula': la composición de HOY de `FeaturedProductsCuadricula.tsx`
// (medida en su fuente, antes de TEMAS-FEATURED-GRILLA-1 vivía en `FeaturedProducts.tsx` sin
// dispatcher) — grid de 4 productos del catálogo, `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
// NINGÚN preset del catálogo pide 'cuadricula': piden 'tabla' (PLIEGO), 'grilla' (PATIO/VITRINA),
// 'mosaico' (VETA) o 'spotlight' (CORTE) — composiciones DISTINTAS entre sí y de la canónica.
//
// `'grilla'` SE SUMÓ EN TEMAS-FEATURED-GRILLA-1 (`FeaturedProductsGrilla.tsx`): una MALLA de 6
// productos, `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` (el ritmo de columnas que ya usa `/tienda`
// para esta misma tarjeta) — deliberadamente DISTINTA de la canónica (más ítems, otra retícula), no
// la canónica con otro nombre. `FeaturedProducts.tsx` YA ES el dispatcher que elige entre las tres
// (§ `content.variantesBandas.featured`, gemelo de `HeroSection`/`GrindChooser` pero leyendo esta
// meta en vez de `sección.variante`). `'tabla'` (PLIEGO) y `'mosaico'` (VETA) SIGUEN sin construir —
// una variante por slice—, así que esos dos themes SIGUEN sin poder aplicarse completos tras este
// cambio (PATIO/VITRINA dejan de fallar en `featured` desde TEMAS-FEATURED-GRILLA-1, pero siguen
// fallando en otras secciones; § `temasCompletos`).
//
// `'spotlight'` SE SUMÓ EN SPOTLIGHT-CABLEADO-HOME-1 (`components/storefront/home/Spotlight.tsx`,
// § SPOTLIGHT-BANDA-1 para el modelo): un solo producto PINEADO con su selector de molienda, notas
// de cata y carrito — reemplaza a la lista plana en el preset que la elija, sin sumar `spotlight`
// a `BANDA_IDS` (la RULING de SPOTLIGHT-BANDA-1 descartó la banda independiente porque exigía que
// `resolverOrden` ganara la capacidad de REMOVER una banda; la variante reusa el dispatcher que ya
// existe). CORTE es hoy el único preset que la pide — su `.spotlight` es LITERALMENTE la sección
// "Producto insignia" del prototipo (`docs/prototipos/cafeone/index.html:159-217`, un solo producto
// con selector y carrito), no la malla de 6 que 'grilla' pintaba ahí antes de este slice.
export const VARIANTES_ESTRUCTURALES: Record<string, VariantesDef> = {
  featured: { claves: ['cuadricula', 'grilla', 'spotlight'], canonica: 'cuadricula' },
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

    // ESCALARES (§ HERO-VIDEO-COMO-DATO-1): más escalares clampados, por NOMBRE — gemelo de
    // VARIANTES arriba, mismo `resolverVariante`, sin la ranura fija `sec.variante`. Hoy sólo
    // `hero.imagenTipo`; genérico para el próximo escalar clampado que aparezca.
    if (def.escalares) {
      for (const [campo, escalarDef] of Object.entries(def.escalares)) {
        sec[campo] = resolverVariante(escalarDef, storedSec[campo]);
      }
    }

    // BOOLEANOS (§ TEMAS-HERO-MEDIA-AGREGADOS-1): campos true/false ADICIONALES a `visible`, por
    // NOMBRE — mismo mecanismo que `storedSec.visible` arriba (sólo un booleano EXPLÍCITO
    // sobreescribe; ausente/basura deja el default, que `sec` ya trae por el `{ ...defaults }`
    // inicial). Hoy sólo `hero.ctasVisibles`/`hero.cueDesliza`; genérico para el próximo booleano
    // de sección que aparezca.
    if (def.booleanos) {
      for (const campo of def.booleanos) {
        if (typeof storedSec[campo] === 'boolean') sec[campo] = storedSec[campo];
      }
    }

    out[key] = sec;
  }

  // PÁGINAS (meta, no sección): sólo `visible` booleano por página; el default manda si el guardado
  // no trae un booleano explícito. Es lo que gatea el redirect de /nosotros y el enlace del nav.
  out.paginas = resolverPaginas(raw.paginas, defaultsBase.paginas);
  // TEMA (meta, no sección): las 3 raíces de paleta, resueltas aparte del loop igual que `paginas`.
  out.tema = resolverTema(raw.tema, defaultsBase.tema);
  // CROMO (meta, no sección, § CROMO-NAV-FOOTER-TEMATIZABLE-1): los 3 ejes de chrome de nav/footer,
  // resueltos aparte del loop y aparte de `tema` —dominio CERRADO (3 claves fijas) igual que
  // `paginas`, nunca tocado por el guardar/publicar de la PALETA (§ el docstring de `CromoContent`).
  out.cromo = resolverCromo(raw.cromo, defaultsBase.cromo);
  // VOLVER ARRIBA (meta, no sección, § CROMO-VOLVER-ARRIBA-1): ¿se monta el botón flotante?,
  // resuelto aparte de `cromo` (dominio CERRADO propio, 1 clave) por el motivo del docstring de
  // `VolverArribaContent` — no comparte contrato con `cromo`.
  out.volverArriba = resolverVolverArriba(raw.volverArriba, defaultsBase.volverArriba);
  // RIEL SOCIAL (meta, no sección, § CROMO-RIEL-SOCIAL-1): ¿se monta el riel fijo a la izquierda?,
  // resuelto aparte de `cromo`/`volverArriba` (dominio CERRADO propio, 1 clave) por el motivo del
  // docstring de `RielSocialContent` — no comparte contrato con ninguna de las dos.
  out.rielSocial = resolverRielSocial(raw.rielSocial, defaultsBase.rielSocial);
  // TRATAMIENTO DEL NAV (meta, no sección, § CROMO-NAV-TRATAMIENTO-1): ¿los links del nav llevan
  // mayúscula+tracking+peso?, resuelto aparte de `cromo`/`volverArriba`/`rielSocial` (dominio
  // CERRADO propio, 1 clave) por el motivo del docstring de `NavTratamientoContent` — no comparte
  // contrato con ninguna de las tres.
  out.navTratamiento = resolverNavTratamiento(raw.navTratamiento, defaultsBase.navTratamiento);
  // TRATAMIENTO DEL WORDMARK APILADO (meta, no sección, § CORTE-LOGO-APILADO-1): ¿el nombre+sub del
  // wordmark apilado del nav calzan el `.wordmark`/`.wordmark small` del prototipo?, resuelto aparte
  // de `cromo`/`volverArriba`/`rielSocial`/`navTratamiento` (dominio CERRADO propio, 1 clave) por el
  // motivo del docstring de `NavWordmarkContent` — no comparte contrato con ninguna de las cuatro.
  out.navWordmark = resolverNavWordmark(raw.navWordmark, defaultsBase.navWordmark);
  // ESQUEMAS (meta, no sección): el mapa banda→esquema, resuelto aparte del loop igual que `paginas`
  // y `tema` — pero KEY-AGNÓSTICO (§ `resolverEsquemas`, abajo): a diferencia de esas dos, no hay un
  // `defaults` con un set fijo de claves que enumerar.
  out.esquemas = resolverEsquemas(raw.esquemas);
  // ORDEN (meta, no sección): la secuencia de bandas, resuelta aparte del loop igual que las otras
  // tres — pero con dominio CERRADO (§ `resolverOrden`, abajo), a diferencia de `esquemas`.
  out.orden = resolverOrden(raw.orden);
  // VARIANTES DE BANDAS ESTRUCTURALES (meta, no sección): el mapa bandaId→variante para bandas sin
  // sección (`featured`), resuelto aparte del loop igual que `esquemas` — GEMELO exacto, mismo
  // dominio ABIERTO (§ `resolverVariantesBandas`, abajo).
  out.variantesBandas = resolverVariantesBandas(raw.variantesBandas);
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
  //
  // origenTexto/origenAccion (§ TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1): SOFT, igual que las raíces —
  // sólo un valor del set cerrado sobrevive, cualquier otra cosa (ausente, basura, un string que no
  // es el único miembro no-default) cae a `null`. Sin `defaults`, por la misma razón que fuentePar/
  // forma: el default DE ESTOS DOS ES `null` (§ el docstring de `TemaContent`).
  return {
    fondo: raiz('fondo'), tinta: raiz('tinta'), acento: raiz('acento'),
    fuentePar: resolverFuentePar(st['fuentePar']),
    forma: resolverForma(st['forma']),
    origenTexto: st['origenTexto'] === 'tinta' ? 'tinta' : null,
    origenAccion: st['origenAccion'] === 'acento' ? 'acento' : null,
    // escalaDisplay (§ TEMAS-ESCALA-DISPLAY-1): SOFT, misma familia — `resolverEscalaDisplay`
    // hace el mismo trabajo que el chequeo inline de arriba (sólo el único miembro del set cerrado
    // sobrevive), extraído a función porque `fontSizeDisplay` necesita el mismo tipo y las dos
    // viven en `escala-display.ts` para que un test puro las afirme sin tocar este archivo.
    escalaDisplay: resolverEscalaDisplay(st['escalaDisplay']),
  };
}

// Resuelve el CROMO (§ CROMO-NAV-FOOTER-TEMATIZABLE-1), gemelo de `resolverPaginas`: dominio
// CERRADO de 3 claves FIJAS (a diferencia de `resolverEsquemas`/`resolverVariantesBandas`, que son
// key-agnósticas). Cada clave sale del guardado sólo si es del TIPO correcto (boolean/string); si
// no —ausente, basura—, cae al default (que siempre es el byte-idéntico de HOY:
// `false`/`false`/`''`). SOFT, nunca lanza.
export function resolverCromo(stored: unknown, defaults: unknown): CromoContent {
  const st = esObj(stored) ? stored : {};
  const def = esObj(defaults) ? defaults : {};
  const bool = (k: string): boolean => {
    const sv = st[k];
    if (typeof sv === 'boolean') return sv;
    const dv = def[k];
    return typeof dv === 'boolean' ? dv : false;
  };
  const str = (k: string): string => {
    const sv = st[k];
    if (typeof sv === 'string') return sv;
    const dv = def[k];
    return typeof dv === 'string' ? dv : '';
  };
  return {
    navTinta: bool('navTinta'),
    navSubtitulo: bool('navSubtitulo'),
    navBadge: str('navBadge'),
  };
}

// Resuelve VOLVER ARRIBA (§ CROMO-VOLVER-ARRIBA-1), gemelo de `resolverCromo` en FORMA (dominio
// CERRADO, SOFT, nunca lanza) pero meta PROPIA — ver el docstring de `VolverArribaContent` para el
// porqué de que no comparta objeto con `cromo`.
export function resolverVolverArriba(stored: unknown, defaults: unknown): VolverArribaContent {
  const st = esObj(stored) ? stored : {};
  const def = esObj(defaults) ? defaults : {};
  const sv = st['visible'];
  if (typeof sv === 'boolean') return { visible: sv };
  const dv = def['visible'];
  return { visible: typeof dv === 'boolean' ? dv : false };
}

// Resuelve RIEL SOCIAL (§ CROMO-RIEL-SOCIAL-1), gemelo de `resolverVolverArriba` en FORMA (dominio
// CERRADO, SOFT, nunca lanza) pero meta PROPIA — ver el docstring de `RielSocialContent` para el
// porqué de que no comparta objeto con `cromo` ni con `volverArriba`.
export function resolverRielSocial(stored: unknown, defaults: unknown): RielSocialContent {
  const st = esObj(stored) ? stored : {};
  const def = esObj(defaults) ? defaults : {};
  const sv = st['visible'];
  if (typeof sv === 'boolean') return { visible: sv };
  const dv = def['visible'];
  return { visible: typeof dv === 'boolean' ? dv : false };
}

// Resuelve el TRATAMIENTO DEL NAV (§ CROMO-NAV-TRATAMIENTO-1), gemelo de `resolverRielSocial` en
// FORMA (dominio CERRADO, SOFT, nunca lanza) pero meta PROPIA — ver el docstring de
// `NavTratamientoContent` para el porqué de que no comparta objeto con `cromo`, `volverArriba` ni
// `rielSocial`.
export function resolverNavTratamiento(stored: unknown, defaults: unknown): NavTratamientoContent {
  const st = esObj(stored) ? stored : {};
  const def = esObj(defaults) ? defaults : {};
  const sv = st['activo'];
  if (typeof sv === 'boolean') return { activo: sv };
  const dv = def['activo'];
  return { activo: typeof dv === 'boolean' ? dv : false };
}

// Resuelve el TRATAMIENTO DEL WORDMARK APILADO (§ CORTE-LOGO-APILADO-1), gemelo de
// `resolverNavTratamiento` en FORMA (dominio CERRADO, SOFT, nunca lanza) pero meta PROPIA — ver el
// docstring de `NavWordmarkContent` para el porqué de que no comparta objeto con `cromo`,
// `volverArriba`, `rielSocial` ni `navTratamiento`.
export function resolverNavWordmark(stored: unknown, defaults: unknown): NavWordmarkContent {
  const st = esObj(stored) ? stored : {};
  const def = esObj(defaults) ? defaults : {};
  const sv = st['activo'];
  if (typeof sv === 'boolean') return { activo: sv };
  const dv = def['activo'];
  return { activo: typeof dv === 'boolean' ? dv : false };
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

/**
 * Resuelve el mapa bandaId→variante de BANDAS ESTRUCTURALES (TEMAS-P1-FEATURED-VARIANTES-1), gemelo
 * EXACTO de `resolverEsquemas`: KEY-AGNÓSTICO (cualquier bandaId puede tener entrada, se itera el
 * GUARDADO). A diferencia de `resolverEsquemas` (un set CERRADO único de 4 esquemas para toda banda),
 * acá el set de claves válidas es POR-BANDA (`VARIANTES_ESTRUCTURALES[banda].claves`) — como el set
 * de una sección normal es por-sección (`SeccionDef.variantes.claves`). Basura, una banda sin entrada
 * en `VARIANTES_ESTRUCTURALES`, o una clave fuera de su set: NI SIQUIERA aparece en el resultado — la
 * misma "sin override" que `resolverEsquemas`, no un clamp a la canónica (a diferencia de
 * `resolverVariante`, que SÍ clampa porque resuelve DENTRO de una sección que siempre necesita un
 * valor). SOFT, nunca lanza.
 */
export function resolverVariantesBandas(stored: unknown): VariantesBandasContent {
  const st = esObj(stored) ? stored : {};
  const out: VariantesBandasContent = {};
  for (const [banda, val] of Object.entries(st)) {
    const def = VARIANTES_ESTRUCTURALES[banda];
    if (def && typeof val === 'string' && def.claves.includes(val)) out[banda] = val;
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

const MENU_ITEM_ID_SET: ReadonlySet<string> = new Set(MENU_ITEM_IDS);

/** Resuelve las 3 posiciones guardadas del menú (§ CROMO-MENU-COMO-DATO-1, posibles vacías/basura/
 *  duplicadas) al orden final de ids: las válidas y sin repetir, en el orden en que aparecen; lo
 *  faltante se completa con las canónicas restantes, en su orden canónico. GEMELA de `resolverOrden`
 *  (mismo algoritmo — válido-y-primero-visto, luego rellenar con lo que falte en orden canónico—,
 *  otro dominio: `MenuItemId` en vez de `BandaId`), no una copia literal: `resolverOrden` está
 *  atada al tipo `BandaId[]`, así que generalizarla habría tocado el eje de bandas que este slice
 *  no toca. Un tenant que no edita nada da EXACTAMENTE `MENU_ITEM_IDS` — el orden de hoy. */
export function resolverOrdenMenu(posiciones: readonly unknown[]): MenuItemId[] {
  const out: MenuItemId[] = [];
  const vistos = new Set<MenuItemId>();
  for (const v of posiciones) {
    if (typeof v === 'string' && MENU_ITEM_ID_SET.has(v) && !vistos.has(v as MenuItemId)) {
      out.push(v as MenuItemId);
      vistos.add(v as MenuItemId);
    }
  }
  for (const id of MENU_ITEM_IDS) {
    if (!vistos.has(id)) out.push(id);
  }
  return out;
}

/** El LABEL editable de un ítem del menú (§ CROMO-MENU-COMO-DATO-1) — patrón `ctaPrimarioLabel`. */
export function labelDeItemMenu(menu: MenuContent, id: MenuItemId): string {
  if (id === 'tienda') return menu.labelTienda;
  if (id === 'suscripciones') return menu.labelSuscripciones;
  return menu.labelNosotros;
}

const MENU_PATHS: Record<MenuItemId, string> = {
  tienda: '/tienda',
  suscripciones: '/suscripciones',
  nosotros: '/nosotros',
};

// A qué página gatea cada ítem (§ VISIBILIDAD se queda como hoy): `tienda` no tiene página que
// apagar (SIEMPRE visible, como hoy); `suscripciones`/`nosotros` siguen leyendo
// `paginas.*.visible`, SIN CAMBIO — renombrar no es encender.
const MENU_PAGE_GATE: Partial<Record<MenuItemId, 'nosotros' | 'suscripciones'>> = {
  suscripciones: 'suscripciones',
  nosotros: 'nosotros',
};

/** Los ítems del menú a MOSTRAR, en el orden resuelto, con su label editable, su ruta y su BADGE
 *  (§ CORTE-BADGE-COSECHA-EN-MENU-1) —lo que `StoreNav.tsx` necesita para pintar el nav de
 *  escritorio y el drawer móvil (§ CROMO-MENU-COMO-DATO-1). El vocabulario ES la decisión de
 *  producto (qué se ve y en qué orden), así que vive acá y no en un `if` dentro del componente
 *  —mismo criterio que `estadoEntrega`/`lib/metrics/titulares.ts` (§ doctrina).
 *
 *  `badge` es OMITIDO del objeto (no `badge: ''`) cuando el ítem no lo lleva — nunca una clave con
 *  valor vacío/`undefined` — para que `itemsDeMenu` siga siendo BYTE-IDÉNTICO por `deepEqual` a los
 *  literales sin badge que `lib/config/menu-como-dato.test.ts` ya afirma (fuera de `touches:` de
 *  este slice, y `assert.deepEqual` trata una clave `undefined` como una DIVERGENCIA, no como
 *  ausente). Sale del ítem cuyo id coincide con `content.menu.badgeItem` Y trae `badgeTexto`
 *  no-vacío; un `badgeItem` que no matchea ningún id VISIBLE (fuera del set, o gateado por
 *  `paginas.*.visible`) no encuentra dónde mostrarse — preferir callar, mismo criterio que
 *  `menuCtaHref`. */
export function itemsDeMenu(content: SiteContentData): { id: MenuItemId; label: string; path: string; badge?: string }[] {
  const orden = resolverOrdenMenu([content.menu.posicion1, content.menu.posicion2, content.menu.posicion3]);
  const badgeItem = content.menu.badgeItem ?? '';
  const badgeTexto = content.menu.badgeTexto ?? '';
  return orden
    .filter((id) => {
      const gate = MENU_PAGE_GATE[id];
      return !gate || content.paginas[gate].visible;
    })
    .map((id) => ({
      id,
      label: labelDeItemMenu(content.menu, id),
      path: MENU_PATHS[id],
      ...(id === badgeItem && badgeTexto ? { badge: badgeTexto } : {}),
    }));
}

const MENU_CTA_DESTINO_SET: ReadonlySet<string> = new Set(MENU_CTA_DESTINOS);

/** El href del CTA del menú, o `null` si no debe mostrarse: sin label, sin destino válido (fuera
 *  del set cerrado), o apuntando a una página apagada (§ paginas.*.visible) — preferir callar a un
 *  link roto, mismo criterio que `opcionTransferencia`/el CTA de suscripciones sin whatsapp. */
export function menuCtaHref(content: SiteContentData): string | null {
  const { ctaLabel, ctaDestino } = content.menu;
  if (ctaLabel.trim() === '') return null;
  if (!MENU_CTA_DESTINO_SET.has(ctaDestino)) return null;
  if (ctaDestino === '/suscripciones' && !content.paginas.suscripciones.visible) return null;
  if (ctaDestino === '/nosotros' && !content.paginas.nosotros.visible) return null;
  return ctaDestino;
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

/**
 * El PIN de SPOTLIGHT resuelto contra un catálogo (§ SPOTLIGHT-BANDA-1, ver el docstring de
 * `SpotlightContent`): el producto que la banda muestra. GENÉRICO —pide sólo un `slug`, no
 * importa `Product`— para que este módulo de CONFIG no dependa del tipo de dominio del catálogo;
 * el llamador real (`components/storefront/home/Spotlight.tsx`) lo instancia con `Product[]`.
 *
 * Dos casos SIN romper (§ SPOTLIGHT-CAPACIDAD-CENSO-1, "la decisión es PUNTERO, no copia"):
 *  · el `slug` no está vacío pero no matchea NINGÚN producto (se borró, o nunca existió) — la
 *    banda cae al PRIMER producto del catálogo VIVO, nunca a un componente roto. Mismo patrón
 *    que el destino inexistente de Presentaciones (`categoriasDelCatalogo`/`hrefCategoria`): se
 *    declara un fallback, no se esconde el bloque a medias.
 *  · el catálogo está VACÍO — no hay NADA que mostrar, ni el fallback tiene sentido: `null`
 *    (hide-on-empty, gemelo de un repeater con `items: []`).
 */
export function productoSpotlight<T extends { slug: string }>(catalog: readonly T[], slug: string): T | null {
  if (catalog.length === 0) return null;
  return catalog.find((p) => p.slug === slug) ?? catalog[0];
}

/**
 * El producto de "la OTRA talla" (§ SPOTLIGHT-BANDA-1, el eje tamaño como ENLACE, no como
 * variante agrupada — Backlog #62 no se dispara, § SPOTLIGHT-CAPACIDAD-CENSO-1). A diferencia de
 * `productoSpotlight`, NO cae a ningún fallback: un `slug` vacío o que no matchea ningún producto
 * significa "no hay otra talla que ofrecer", y el componente simplemente OMITE el control — mismo
 * criterio que `menuCtaHref` (preferir callar a un link roto, no inventar un destino).
 */
export function productoOtraTalla<T extends { slug: string }>(catalog: readonly T[], slug: string): T | null {
  if (!slug) return null;
  return catalog.find((p) => p.slug === slug) ?? null;
}
