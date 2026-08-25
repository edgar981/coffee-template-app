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

export interface SiteContentData {
  hero: HeroContent;
  // Futuro (sólo datos, sin tocar el modelo): brandStory, testimonials (repeater), subscriptionCTA.
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
  repeater?: { itemsKey: string };
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
export function resolverSiteContent(stored: unknown): SiteContentData {
  const raw = esObj(stored) ? stored : {};
  const out = {} as Record<keyof SiteContentData, unknown>;

  for (const key of Object.keys(DEFAULTS) as (keyof SiteContentData)[]) {
    const def = REGISTRY[key];
    const defaults = DEFAULTS[key] as unknown as Record<string, unknown>;
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
    out[key] = sec;
  }
  return out as SiteContentData;
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
export function seccionEsVisible(def: SeccionDef, sec: Record<string, unknown>): boolean {
  const items = def.repeater ? sec[def.repeater.itemsKey] : undefined;
  const tieneItems = Array.isArray(items) && items.length > 0;

  if (def.repeater && !tieneItems) return false; // hide-on-empty gana sobre todo
  if (!def.ocultable) return true;                // no se puede ocultar (hero)
  return sec.visible !== false;
}
