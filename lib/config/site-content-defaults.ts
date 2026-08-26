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

// SubscriptionCTA ("Plan Suscripción"): eyebrow + h2 + un párrafo + HASTA CUATRO bullets + el label
// del CTA (su href es ESTRUCTURA, `/suscripciones`, no editable). Sección de SOLO TEXTO —sin
// imágenes—. Los bullets son `bullet1..4` OPCIONALES: el componente los junta con un `.filter` que
// SALTA los vacíos, así que "vaciar el 2 y dejar el 3" cierra la lista sin hueco — son "hasta cuatro
// bullets", no "cuatro slots" (el editor lo dice en las etiquetas). 5+ bullets = el repeater
// compartido (§ Backlog #47). Las TRES tarjetas de plan NO viven acá: son ESTRUCTURA desde
// `SUBSCRIPTION_PLANS`, fuente compartida con /suscripciones (§ Backlog #49).
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

export interface SiteContentData {
  hero: HeroContent;
  brandStory: BrandStoryContent;
  subscriptionCTA: SubscriptionCTAContent;
  testimonials: TestimonialsContent;
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
};

// Destinos de los CTA — ESTRUCTURA, no editable. Los labels se editan; los hrefs NO: un
// href arbitrario en el botón principal de la portada lo dejaría apuntando a una ruta que
// no existe. La salida (si algún día se pide editarlos) es un selector entre rutas CONOCIDAS,
// no un campo libre (§ Config del contenido — SiteContent, en doctrina).
export const HERO_HREFS = { primario: '/tienda', secundario: '/suscripciones' } as const;

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

export const REGISTRY: Record<keyof SiteContentData, SeccionDef> = {
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

  for (const key of Object.keys(defaultsBase)) {
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
  return out as unknown as SiteContentData;
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
