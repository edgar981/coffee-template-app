// LAS SECCIONES AGREGADAS del home (§ SECCIONES-INSTANCIAS-1) — el mecanismo que deja que el
// contenido declare INSTANCIAS de un catálogo CURADO de tres tipos genéricos (Texto, Imagen con
// texto, Banner) y las mezcle en `orden` con las bandas de siempre. Sin UI de agregar todavía: lo
// que entra acá es el modelo, el resolver y el schema — la pieza que hace POSIBLE agregar una
// sección, no el botón "+ Agregar sección" (ver `docs/editor-tienda/AGREGAR-SECCIONES.md`).
//
// MÓDULO HOJA A PROPÓSITO: no importa NADA de `site-content-defaults.ts`. Ese archivo SÍ importa
// de acá (`resolverSeccionesHome`, `resolverOrdenCompleto`, tipos) para resolver la clave meta
// `seccionesHome`/`orden` — si este archivo importara de vuelta `BandaId`/`BANDA_IDS`/
// `resolverVariante` desde `site-content-defaults.ts`, los dos módulos se necesitarían uno al otro
// en tiempo de EVALUACIÓN (no sólo de tipos), un ciclo de imports real entre dos módulos con
// `const` de nivel superior — el modo de falla donde uno de los dos lee el `export` del otro antes
// de que se haya inicializado. Por eso `resolverOrdenCompleto` recibe `bandaIds` POR PARÁMETRO en
// vez de importar `BANDA_IDS`, y el escalar `alto` del Banner declara su propio set cerrado de 3
// valores en vez de importar `ALTURAS_HERO`/`resolverVariante` (duplica ~3 líneas triviales; el
// costo de evitarlo —un ciclo entre los dos archivos más grandes de `lib/config/`— es mayor).
//
// DEFAULTS NEUTROS DE VERTICAL (§ CLAUDE.md, "El código compartido no NACE siendo Nayoli/demo"):
// los tres tipos son un catálogo CURADO que cualquier tienda puede usar, café o no — sus textos de
// ejemplo son genéricos, sin una sola palabra de café, y ninguna imagen trae un valor por defecto
// (el hueco "Agregar foto" del editor es el estado inicial correcto, no un placeholder robado de
// otra sección).

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// ─── EL TIPO Y SU PREFIJO DE ID ─────────────────────────────────────────────────────────────────

export const SECCION_INSTANCIA_TIPOS = ['texto', 'imagenTexto', 'banner'] as const;
export type SeccionInstanciaTipo = (typeof SECCION_INSTANCIA_TIPOS)[number];

const TIPOS_SET: ReadonlySet<string> = new Set(SECCION_INSTANCIA_TIPOS);

export function esSeccionInstanciaTipo(v: unknown): v is SeccionInstanciaTipo {
  return typeof v === 'string' && TIPOS_SET.has(v);
}

// `INSTANCIA_PREFIJO` es lo que hace que un id de instancia NUNCA pueda chocar con un `BandaId`
// (`hero`, `marquesina`… ninguno empieza por esto) ni con cualquier id de banda futuro — el
// contrato no depende de enumerar las bandas acá (sería el import circular de arriba), depende de
// que TODO id de banda sea una palabra plana sin ':'. Dos puntos, no un punto: `parsearRutaCampo`
// (`lib/storefront/campo-editable.ts`, fuera de `touches:`) separa una ruta de campo en el PRIMER
// punto (`seccion.campo`), así que un id de instancia con punto rompería ese parseo; con ':' el id
// entero sigue siendo la parte "sección" sin ambigüedad.
export const INSTANCIA_PREFIJO = 'inst:';

export function esInstanciaId(id: string): boolean {
  return id.startsWith(INSTANCIA_PREFIJO) && id.length > INSTANCIA_PREFIJO.length;
}

// ─── EL DESCRIPTOR — ÚNICA FUENTE por tipo, de la que derivan resolver + schema + editor ────────

export type CampoInstanciaTipo = 'requerido' | 'opcional';

/** El set cerrado de un escalar de instancia (alineación, lado, alto) — MISMA forma que
 *  `VariantesDef.claves`/`.canonica` de `site-content-defaults.ts`, sin importarla (ver el
 *  docstring de cabecera: módulo hoja). */
export interface EscalarInstanciaDef {
  claves: readonly string[];
  canonica: string;
}

export interface InstanciaDescriptor {
  /** Campos de TEXTO plano (incluye los destinos de CTA, que son texto libre acá — el set cerrado
   *  de destinos válidos lo valida el SCHEMA de escritura, no el descriptor ni el resolver; mismo
   *  criterio que `brandStory.ctaDestino` en `site-content-schema.ts`). */
  campos: Record<string, CampoInstanciaTipo>;
  /** Cuáles de los campos de arriba son URLs de imagen (para `imagenesDe`/el borrado de blobs). */
  imagenes?: readonly string[];
  /** Escalares clampados a un set cerrado (alineación, lado, alto). */
  escalares?: Record<string, EscalarInstanciaDef>;
}

const ALINEACIONES_TEXTO = { claves: ['izquierda', 'centro', 'derecha'], canonica: 'centro' } as const;
const LADOS_IMAGEN_TEXTO = { claves: ['izquierda', 'derecha'], canonica: 'izquierda' } as const;
// Gemelo de `ALTURAS_HERO`/`CLASES_ALTURA_HERO` (`site-content-defaults.ts`) — mismos TRES pasos,
// misma canónica 'justo'; duplicado acá por el módulo-hoja de arriba. El COMPONENTE (no este
// archivo) sigue usando `claseAlturaHero` de verdad para traducir el valor a una clase Tailwind —
// esa función SÍ se importa desde el componente (`components/storefront/secciones/Banner.tsx`),
// que no es leído de vuelta por `site-content-defaults.ts`, así que ahí no hay ciclo que evitar.
const ALTURAS_BANNER = { claves: ['justo', 'alto', 'pantalla'], canonica: 'justo' } as const;

export const DESCRIPTOR_INSTANCIA: Record<SeccionInstanciaTipo, InstanciaDescriptor> = {
  texto: {
    campos: {
      antetitulo: 'opcional',
      titulo: 'requerido',
      texto: 'opcional',
      ctaLabel: 'opcional',
      ctaDestino: 'opcional',
    },
    escalares: { alineacion: ALINEACIONES_TEXTO },
  },
  imagenTexto: {
    campos: {
      antetitulo: 'opcional',
      titulo: 'requerido',
      texto: 'opcional',
      ctaLabel: 'opcional',
      ctaDestino: 'opcional',
      imagen: 'opcional',
    },
    imagenes: ['imagen'],
    escalares: { lado: LADOS_IMAGEN_TEXTO },
  },
  banner: {
    campos: {
      titulo: 'requerido',
      texto: 'opcional',
      ctaLabel: 'opcional',
      ctaDestino: 'opcional',
      ctaSecundarioLabel: 'opcional',
      ctaSecundarioDestino: 'opcional',
      imagen: 'opcional',
    },
    imagenes: ['imagen'],
    escalares: { alto: ALTURAS_BANNER },
  },
};

// ─── LOS DEFAULTS — NEUTROS, sin café, sin imagen ───────────────────────────────────────────────

export interface InstanciaTextoContent {
  tipo: 'texto';
  antetitulo: string;
  titulo: string;
  texto: string;
  ctaLabel: string;
  ctaDestino: string;
  alineacion: string;
}

export interface InstanciaImagenTextoContent {
  tipo: 'imagenTexto';
  antetitulo: string;
  titulo: string;
  texto: string;
  ctaLabel: string;
  ctaDestino: string;
  imagen: string;
  lado: string;
}

export interface InstanciaBannerContent {
  tipo: 'banner';
  titulo: string;
  texto: string;
  ctaLabel: string;
  ctaDestino: string;
  ctaSecundarioLabel: string;
  ctaSecundarioDestino: string;
  imagen: string;
  alto: string;
}

export type InstanciaContent = InstanciaTextoContent | InstanciaImagenTextoContent | InstanciaBannerContent;

// Tipado POR CLAVE (no `Record<SeccionInstanciaTipo, InstanciaContent>`): así `DEFAULTS_INSTANCIA.texto`
// sigue siendo `InstanciaTextoContent` para quien lo lea (p. ej. un test que compara
// `DEFAULTS_INSTANCIA.texto.antetitulo`), en vez de la unión completa sin narrow.
export const DEFAULTS_INSTANCIA: {
  texto: InstanciaTextoContent;
  imagenTexto: InstanciaImagenTextoContent;
  banner: InstanciaBannerContent;
} = {
  texto: {
    tipo: 'texto',
    antetitulo: '',
    titulo: 'Un título para esta sección',
    texto: 'Escribe acá el texto que quieras mostrar en este bloque.',
    ctaLabel: '',
    ctaDestino: '',
    alineacion: ALINEACIONES_TEXTO.canonica,
  },
  imagenTexto: {
    tipo: 'imagenTexto',
    antetitulo: '',
    titulo: 'Un título para esta sección',
    texto: 'Escribe acá el texto que acompaña a la imagen.',
    ctaLabel: '',
    ctaDestino: '',
    imagen: '',
    lado: LADOS_IMAGEN_TEXTO.canonica,
  },
  banner: {
    tipo: 'banner',
    titulo: 'Un título para este banner',
    texto: '',
    ctaLabel: '',
    ctaDestino: '',
    ctaSecundarioLabel: '',
    ctaSecundarioDestino: '',
    imagen: '',
    alto: ALTURAS_BANNER.canonica,
  },
};

// ─── EL RESOLVER — SOFT, por el MISMO contrato que `resolverSiteContent` (requerido vacío → el
//     default; opcional presente-aunque-vacío → se respeta; escalar basura → la canónica) ───────

function resolverEscalarInstancia(def: EscalarInstanciaDef, v: unknown): string {
  return typeof v === 'string' && def.claves.includes(v) ? v : def.canonica;
}

/** Resuelve UNA instancia guardada. `null` si `stored` no es un objeto o su `tipo` no es uno de
 *  los tres del catálogo — "tipo desconocido o basura → se descarta" (§ el spec de este slice):
 *  una instancia que no se puede reconocer no se inventa, se omite entera (nunca a medias). */
export function resolverInstancia(stored: unknown): InstanciaContent | null {
  if (!esObj(stored) || !esSeccionInstanciaTipo(stored.tipo)) return null;
  const tipo = stored.tipo;
  const descriptor = DESCRIPTOR_INSTANCIA[tipo];
  const defaults = DEFAULTS_INSTANCIA[tipo] as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { tipo };

  for (const [campo, kind] of Object.entries(descriptor.campos)) {
    const val = stored[campo];
    if (kind === 'requerido') {
      out[campo] = typeof val === 'string' && val.trim() !== '' ? val : defaults[campo];
    } else {
      out[campo] = campo in stored ? (typeof val === 'string' ? val : defaults[campo]) : defaults[campo];
    }
  }

  if (descriptor.escalares) {
    for (const [campo, def] of Object.entries(descriptor.escalares)) {
      out[campo] = resolverEscalarInstancia(def, stored[campo]);
    }
  }

  return out as unknown as InstanciaContent;
}

/** Resuelve TODA la meta `seccionesHome` — el mapa id→instancia, KEY-AGNÓSTICO (como `esquemas`/
 *  `variantesBandas`): no hay un set fijo de ids que enumerar, lo decide el dueño al agregar una.
 *  Dos guardas SOFT, las dos "se descarta, no se inventa": una clave sin el prefijo de instancia
 *  no es una instancia de este mecanismo (podría ser basura de otra fuente, o un id que alguien
 *  escribió a mano sin el prefijo) y se ignora; una instancia cuyo `resolverInstancia` da `null`
 *  (tipo desconocido/forma rota) también se ignora. Nunca lanza. */
export function resolverSeccionesHome(stored: unknown): Record<string, InstanciaContent> {
  const out: Record<string, InstanciaContent> = {};
  if (!esObj(stored)) return out;
  for (const [id, val] of Object.entries(stored)) {
    if (!esInstanciaId(id)) continue;
    const resuelto = resolverInstancia(val);
    if (resuelto) out[id] = resuelto;
  }
  return out;
}

// ─── EL ORDEN COMPLETO — bandas ∪ instancias, mismo algoritmo que `resolverOrden` ───────────────

/**
 * Generaliza `resolverOrden` (`site-content-defaults.ts`) a un dominio de ids ABIERTO: bandas
 * MÁS instancias, declaradas por el LLAMADOR (`bandaIds`/`instanciaIds`) en vez de un
 * `BANDA_IDS` importado — ver el docstring de cabecera para el porqué (evitar el ciclo de
 * imports). MISMO contrato que su gemela: filtra `stored` a ids conocidos (una banda, o una
 * instancia que de verdad existe en `seccionesHome` — "el id entra a `orden` sólo si su
 * instancia existe"), DEDUPLICA (primera aparición gana), y agrega al final lo que falte —
 * primero las bandas que falten en su orden canónico, luego las instancias que falten en el
 * orden en que `instanciaIds` las trae (el orden de inserción de `Object.entries`, que en JS
 * preserva el orden de escritura de claves string). SOFT, nunca lanza.
 *
 * `instanciaIds: []` (el caso de HOY, sin una sola instancia) hace que esta función sea
 * EXACTAMENTE `resolverOrden`: mismo algoritmo sobre el mismo dominio — "sin la clave nueva, toda
 * tienda es byte-idéntica" se cumple por construcción, no por un camino especial para el caso
 * vacío.
 */
export function resolverOrdenCompleto(
  stored: unknown,
  bandaIds: readonly string[],
  instanciaIds: readonly string[],
): string[] {
  const out: string[] = [];
  const vistos = new Set<string>();
  const validos = new Set<string>([...bandaIds, ...instanciaIds]);
  if (Array.isArray(stored)) {
    for (const v of stored) {
      if (typeof v === 'string' && validos.has(v) && !vistos.has(v)) {
        out.push(v);
        vistos.add(v);
      }
    }
  }
  for (const id of bandaIds) if (!vistos.has(id)) out.push(id);
  for (const id of instanciaIds) if (!vistos.has(id)) out.push(id);
  return out;
}

// ─── LAS IMÁGENES — para `imagenesDe` (site-content-blobs.ts) ───────────────────────────────────

/** Los campos de imagen de CADA instancia realmente presente en `seccionesHome` (ya resuelto, o
 *  crudo — acepta lo que `imagenesDe` ya tiene en mano en cualquiera de los dos casos, porque sólo
 *  lee strings por nombre de campo, nunca re-resuelve nada). Vive acá y no en `site-content-
 *  blobs.ts` porque es el ÚNICO módulo que sabe qué campo de cada TIPO es una imagen. */
export function imagenesDeInstancia(inst: unknown): string[] {
  const out: string[] = [];
  if (!esObj(inst) || !esSeccionInstanciaTipo(inst.tipo)) return out;
  const campos = DESCRIPTOR_INSTANCIA[inst.tipo].imagenes;
  if (!campos) return out;
  for (const campo of campos) {
    const v = inst[campo];
    if (typeof v === 'string' && v.trim() !== '') out.push(v);
  }
  return out;
}

// ─── DARKNESS/UNIFORMIDAD — para el día que el nav sepa de instancias (§ DECISIONS.md, abierto) ──

/** ¿Un `banner` cuenta como banda OSCURA cuando no tiene esquema asignado? SÍ — es foto de fondo
 *  con velo, la MISMA forma que el hero 'curtina' (fondo oscuro por construcción). `texto`/
 *  `imagenTexto` son CLAROS por default (fondo de página, como el resto de las bandas claras). */
export function instanciaOscuraCanonica(tipo: SeccionInstanciaTipo): boolean {
  return tipo === 'banner';
}

/** ¿Un `imagenTexto` es una banda UNIFORME (un solo tono) para el nav flotante? NO — es bi-tonal
 *  por LAYOUT (imagen a un lado, fondo de página al otro), la misma razón que vuelve no-uniforme
 *  al hero 'ficha' (§ `bandaUniforme`, `site-content-defaults.ts`). `texto`/`banner` son UN solo
 *  fondo de un extremo al otro → uniformes. */
export function instanciaEsUniforme(tipo: SeccionInstanciaTipo): boolean {
  return tipo !== 'imagenTexto';
}
