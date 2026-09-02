// DEFAULTS + REGISTRY + resolver del CONTENIDO del storefront. Módulo PURO —sin prisma,
// sin server-only— para que capa 1 lo pruebe y para que el carril/route handlers lo usen.
//
// LOADER SOFT (lo opuesto a SiteSetting): el vacío es un estado LEGÍTIMO del editor, no un
// error. Nada falla ruidoso; un campo vacío cae al default (requerido) o se omite (opcional).
// Sin fila en la base, gobiernan estos defaults — por eso SiteContent no siembra fila en su
// migración.

export interface HeroContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  tituloEnfasis: string;
  subtitulo: string;
  ctaPrimarioLabel: string;
  ctaSecundarioLabel: string;
  imagen: string;
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
}

// Presentaciones ("¿Cómo tomas tu café?"): DOS tarjetas de presentación del producto. CARDINALIDAD
// FIJA —el grid asume 2, sin agregar ni quitar—, así que son campos PLANOS (patrón brandStory), NO un
// repeater: un repeater es para cardinalidad VARIABLE y sus defaults JAMÁS se muestran (§ doctrina:
// cardinalidad fija → campos planos). Cada tarjeta: label + copy + imagen (todos requeridos → vacío
// cae al default, el storefront no muestra una tarjeta a medias). Los `path` NO están acá: son
// ESTRUCTURA (PRESENTACIONES_HREFS, destinos fijos), no editables (precedente HERO_HREFS).
export interface PresentacionesContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  label1: string;
  copy1: string;
  imagen1: string;
  label2: string;
  copy2: string;
  imagen2: string;
}

// SubscriptionCTA ("Plan Suscripción"): eyebrow + h2 + un párrafo + HASTA CUATRO bullets + el label
// del CTA (su href es ESTRUCTURA, `/suscripciones`, no editable). Sección de SOLO TEXTO —sin
// imágenes—. Los bullets son `bullet1..4` OPCIONALES: el componente los junta con un `.filter` que
// SALTA los vacíos, así que "vaciar el 2 y dejar el 3" cierra la lista sin hueco — son "hasta cuatro
// bullets", no "cuatro slots" (el editor lo dice en las etiquetas). 5+ bullets = el repeater
// compartido (la plataforma ya lo tiene). Las TRES tarjetas de plan NO viven acá: son ESTRUCTURA
// desde `SUBSCRIPTION_PLANS`, fuente compartida con /suscripciones (§ Backlog #49).
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

// META de páginas: qué páginas del storefront están ENCENDIDAS. NO es una sección (no lleva `campos`
// ni la resuelve el loop de secciones); es una capacidad —una página existe y se puede apagar—. Hoy
// sólo /nosotros; la home no se apaga.
export interface PaginasContent {
  nosotros: { visible: boolean };
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
}

export interface SiteContentData {
  hero: HeroContent;
  brandStory: BrandStoryContent;
  presentaciones: PresentacionesContent;
  subscriptionCTA: SubscriptionCTAContent;
  testimonials: TestimonialsContent;
  nosotrosHistoria: NosotrosHistoriaContent;
  nosotrosGaleria: NosotrosGaleriaContent;
  paginas: PaginasContent;
  tema: TemaContent;
}

// Los DEFAULTS son los literales que hoy viven en el JSX del hero. Se mueven acá; el
// componente los recibe resueltos.
export const DEFAULTS: SiteContentData = {
  hero: {
    visible: true,
    eyebrow: 'Café de Especialidad · Colombia',
    titulo: 'Café que cuenta',
    tituloEnfasis: 'historias',
    subtitulo:
      'Café de especialidad cultivado por nuestra familia en Supatá, Cundinamarca. Una sola finca, una sola variedad, tostado en tandas semanales.',
    ctaPrimarioLabel: 'Explorar Café',
    ctaSecundarioLabel: 'Suscripción Mensual',
    imagen: '/images/hero-beans-v1.jpg',
  },
  brandStory: {
    visible: true,
    eyebrow: 'Nuestra Historia',
    titulo: 'Del cafetal a tu taza',
    parrafo1:
      'Café Nayoli nace en un solo lugar: la Finca Nayoli, en la vereda Providencia de Supatá, Cundinamarca. Cada grano viene de esta tierra, cultivado entre los 1.650 y 2.100 metros sobre el nivel del mar, donde la altura y el clima de la montaña colombiana dan al café su carácter.',
    parrafo2:
      'Trabajamos una sola variedad, Castillo, con proceso lavado — el método que mejor revela lo que esta tierra tiene para ofrecer. El resultado es una taza con fragancia a chocolate, aroma herbal e intenso, y un balance preciso entre acidez y cuerpo. El equilibrio que buscamos en cada tostión. Somos café de especialidad, 100% colombiano, de una finca con nombre y una historia que apenas comienza a contarse. Cuando abres una bolsa de Nayoli, sabes exactamente de dónde viene — y ese, para nosotros, es el verdadero secreto de Supatá.',
    imagen1: '/images/products-9.jpg',
    imagen2: '/images/products-7.jpeg',
    imagen3: '/images/products-10.jpg',
    imagen4: '/images/products-11.jpg',
  },
  // Los literales que hoy viven en GrindChooser (OPCIONES + el encabezado). Byte a byte: sin fila de
  // SiteContent, la home queda IDÉNTICA (§ el test de byte-idéntico). Las imágenes son paths /public
  // (como el hero) — override por Blob, next/image sirve ambos, `storage.delete` es no-op sobre estáticos.
  presentaciones: {
    visible: true,
    eyebrow: 'Elige tu presentación',
    titulo: '¿Cómo tomas tu café?',
    label1: 'En grano',
    copy1: 'Para moler en casa, máxima frescura.',
    imagen1: '/images/cafe-nayoli-250g-grano.webp',
    label2: 'Molido',
    copy2: 'Listo para tu greca, filtro o prensa.',
    imagen2: '/images/cafe-nayoli-250g-molido.webp',
  },
  subscriptionCTA: {
    visible: true,
    eyebrow: 'Plan Suscripción',
    titulo: 'Tu café de Supatá, cada mes',
    subtitulo: 'El mismo café de nuestra finca, tostado fresco y enviado a tu puerta. Pausa o cancela cuando quieras.',
    bullet1: 'El mismo café de nuestra finca en Supatá',
    bullet2: 'Grano o molido, como prefieras',
    bullet3: 'Tostado fresco en tandas semanales',
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
    eyebrow: 'Nuestra Historia',
    titulo: 'Del cafetal a tu taza',
    parrafo1:
      'Café Nayoli nace en un solo lugar: la Finca Nayoli, en la vereda Providencia de Supatá, Cundinamarca. Cada grano viene de esta tierra, cultivado entre los 1.650 y 2.100 metros sobre el nivel del mar, donde la altura y el clima de la montaña colombiana dan al café su carácter.',
    parrafo2:
      'Trabajamos una sola variedad, Castillo, con proceso lavado — el método que mejor revela lo que esta tierra tiene para ofrecer. El resultado es una taza con fragancia a chocolate, aroma herbal e intenso, y un balance preciso entre acidez y cuerpo. El equilibrio que buscamos en cada tostión. Somos café de especialidad, 100% colombiano, de una finca con nombre y una historia que apenas comienza a contarse. Cuando abres una bolsa de Nayoli, sabes exactamente de dónde viene — y ese, para nosotros, es el verdadero secreto de Supatá.',
    parrafo3: '',
  },
  // La galería de /nosotros. Encabezado con defaults de COPY (se muestran sólo cuando hay fotos, por
  // hide-on-empty); `items` VACÍO —las fotos de la finca son DATO del owner, no hay imagen que
  // fabricar en defaults—. Con items vacíos la sección no se renderiza.
  nosotrosGaleria: {
    visible: true,
    eyebrow: 'Galería',
    titulo: 'La finca en imágenes',
    items: [],
  },
  // DEFAULT ENCENDIDA (Nayoli tiene historia real): al deployar, /nosotros queda viva y el enlace
  // "Nosotros" apunta a la página. Un cliente que no la use la apaga (§ decisión del owner). NO es
  // un claim falso —es copy editable, no una reseña inventada—, así que default-encendida no repite
  // el caso de los testimonios.
  paginas: {
    nosotros: { visible: true },
  },
  // TEMA por defecto: las 3 raíces en null → el storefront usa los defaults de código (§ globals.css
  // `--sf-*`), que SON la paleta de Nayoli → byte-idéntico sin depender de una fila. Un cliente setea
  // sus raíces y el motor deriva el resto. La migración NO siembra `tema` (loader SOFT, como todo
  // SiteContent): sin la clave, `resolverTema` la resuelve a estos nulls.
  tema: {
    fondo: null,
    tinta: null,
    acento: null,
  },
};

// Destinos de los CTA — ESTRUCTURA, no editable. Los labels se editan; los hrefs NO: un
// href arbitrario en el botón principal de la portada lo dejaría apuntando a una ruta que
// no existe. La salida (si algún día se pide editarlos) es un selector entre rutas CONOCIDAS,
// no un campo libre (§ Config del contenido — SiteContent, en doctrina).
export const HERO_HREFS = { primario: '/tienda', secundario: '/suscripciones' } as const;

// Destinos de las dos tarjetas de Presentaciones — ESTRUCTURA, no editable (misma decisión que
// HERO_HREFS). Los labels y copys se editan; los paths NO: apuntan a filtros de categoría que deben
// existir, y un path libre dejaría la tarjeta apuntando a una ruta muerta.
export const PRESENTACIONES_HREFS = { path1: '/tienda?cat=cafe_grano', path2: '/tienda?cat=cafe_molido' } as const;

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

export interface SeccionDef {
  /** Nombre de la sección en el selector del editor (§ /admin/tienda). */
  label: string;
  ocultable: boolean;
  /** Sección de LISTA: `itemsKey` es la clave del array; `campos` es la config de campos de CADA
   *  ÍTEM (requerido/opcional, para el resolver). Los campos NO-string del ítem (p. ej. un rating
   *  numérico) no van acá: el resolver los pasa tal cual. Coexiste con `campos` de sección. */
  repeater?: { itemsKey: string; campos: Record<string, CampoTipo> };
  campos: Record<string, CampoTipo>;
  /** Nombres de los campos que son IMÁGENES (blobs). Los lee el borrado de blobs reemplazados
   *  (`imagenesDe`), NO el resolver. Para un repeater la imagen vive en cada item. */
  imagenes?: string[];
}

// Las claves de SECCIÓN (todo `SiteContentData` menos las META `paginas` y `tema`, que no son
// secciones). El REGISTRY las cubre a todas; `paginas` y `tema` quedan fuera a propósito —cada una se
// resuelve aparte del loop de secciones.
export type SeccionKey = Exclude<keyof SiteContentData, 'paginas' | 'tema'>;

export const REGISTRY: Record<SeccionKey, SeccionDef> = {
  hero: {
    label: 'Portada',
    ocultable: false,
    imagenes: ['imagen'],
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
    // Cardinalidad FIJA (2 tarjetas): campos PLANOS con imágenes, como brandStory —NO un repeater—.
    // Los dos campos-imagen se borran de Blob por diff (`imagenesDe` lee esto). Todos los textos
    // requeridos: una tarjeta sin label/copy/imagen se ve rota, así que vacío cae al default.
    imagenes: ['imagen1', 'imagen2'],
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
      label1: 'requerido',
      copy1: 'requerido',
      imagen1: 'requerido',
      label2: 'requerido',
      copy2: 'requerido',
      imagen2: 'requerido',
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
};

const esVacio = (v: unknown): boolean => typeof v !== 'string' || v.trim() === '';
const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

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

    out[key] = sec;
  }

  // PÁGINAS (meta, no sección): sólo `visible` booleano por página; el default manda si el guardado
  // no trae un booleano explícito. Es lo que gatea el redirect de /nosotros y el enlace del nav.
  out.paginas = resolverPaginas(raw.paginas, defaultsBase.paginas);
  // TEMA (meta, no sección): las 3 raíces de paleta, resueltas aparte del loop igual que `paginas`.
  out.tema = resolverTema(raw.tema, defaultsBase.tema);
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
  return { fondo: raiz('fondo'), tinta: raiz('tinta'), acento: raiz('acento') };
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
