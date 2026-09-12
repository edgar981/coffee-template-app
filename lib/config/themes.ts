// EL PRESET DE THEME COMO DATO (§ programa THEMES, pieza 0(d)). Un theme NO es código aparte: es un
// PRESET de los seis ejes que `SiteContent` ya sabe guardar — las 3 raíces de paleta, el par
// tipográfico, la forma, la VARIANTE de cada sección con slot, el mapa banda→esquema y el orden de
// bandas —, declarado contra el contrato que YA existe (`REGISTRY`, `BANDA_IDS`, `CLAVES_FUENTES`,
// `CLAVES_FORMAS`). Nayoli es el theme canónico y no se rediseña; los cinco de acá son la
// composición del CATÁLOGO de Duna.
//
// LA COMPOSICIÓN SE ARMA EN ONBOARDING, NUNCA EN EL PANEL DEL CLIENTE (DECISIONS.md, retiro de
// EJE-5-ORDEN-EDITOR-1/EJE-5-VARIANTES-EDITOR): «la rigidez es la garantía de que ninguna tienda de
// Duna se ve mal». Por eso este módulo NO monta UI ni endpoint — es una función que corre desde un
// runbook (`aplicarPreset`, en `site-content-write.ts`).
//
// MEDIDO CONTRA EL CÓDIGO, no contra la entrega de diseño (que vive fuera de este repo): la mayoría
// de las CLAVES de variante que el diseño describe (marquesina, tabla, hilo, chips, ticket, media,
// linea, collage, bento) NO EXISTEN todavía en el REGISTRY — hoy sólo `hero` (`curtina`|`ficha`) y
// `presentaciones` (`mosaico`|`indice`) declaran `variantes`. `brandStory` y `subscriptionCTA` NO
// tienen slot de variante (confirmado por grep: `REGISTRY.brandStory`/`.subscriptionCTA` no declaran
// `variantes`, y sus interfaces —`BrandStoryContent`/`SubscriptionCTAContent`— no tienen campo
// `variante`); `featured`/`trustBadges` ni siquiera son `SeccionKey` (son bandas ESTRUCTURALES sin
// sección en `SiteContentData`, § `site-content-defaults.ts`). Esto CONTRADICE una premisa del spec
// de este slice, que afirmaba «brandStory acaba de ganar su slot con una clave» — no es así hoy; se
// deja anotado y reportado en vez de tocar el REGISTRY (fuera de `touches`, y § doctrina «el REGISTRY
// no se toca desde acá»).
//
// POR ESO LOS CINCO THEMES DISEÑADOS SON, A PROPÓSITO, INCOMPLETOS: `variantes` abajo registra la
// intención COMPLETA del diseño (incluidas las claves de sección que hoy no tienen dónde vivir), y
// `validarPreset` la enfrenta contra el REGISTRY real. Nada se inventa para que "pasen": el preset
// que SÍ aplica hoy es `ARRANQUE`, construido sólo con capacidades reales.
//
// PURO: sin prisma, sin server-only. `validarPreset`/`temasCompletos`/`mergePresetEnContent` corren
// en capa 1; la escritura a la base (`aplicarPreset`) vive en `site-content-write.ts`, que importa
// de acá — igual que `guardarTemaBorrador` separa el cálculo (implícito, simple) de la transacción.

import { CLAVES_FUENTES, type ClaveFuentePar, resolverFuentePar } from './fuentes';
import { CLAVES_FORMAS, type ClaveForma, resolverForma } from './formas';
import {
  REGISTRY, BANDA_IDS, ORDEN_DEFAULT, type SeccionDef, type BandaId, type ClaveEsquema,
} from './site-content-defaults';
import { RAICES_DEFECTO } from './palette-derive';

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// Duplicado LITERAL, y a propósito documentado: el set de 4 esquemas ya vive como `ESQUEMA_IDS` en
// `site-content-defaults.ts`, pero esa constante NO está exportada y ese archivo NO está en
// `touches` de este slice (§ NO SE TOCA — el REGISTRY, el schema). Agregar el export ahí sería
// ensanchar el diff fuera de lo aprobado; se acepta esta única lista corta, gemela del tipo
// `ClaveEsquema` (= `EsquemaId` de `palette-derive.ts`), como la excepción que confirma la regla
// «derivada, no una segunda lista» — el día que se toque ese archivo por otra razón, se exporta y
// esta lista se reemplaza por el import.
const ESQUEMAS_VALIDOS: readonly ClaveEsquema[] = ['crema', 'superficie', 'oscuro', 'acento'];

/**
 * Un PRESET de theme: los seis ejes que `SiteContent` sabe guardar, tal como los declaró el diseño.
 *
 * `fuentePar`/`forma`: la CLAVE decidida (incluida la canónica — `'editorial'`/`'suave'` son
 * elecciones válidas, no la ausencia de una) o `null` = SIN DECIDIR TODAVÍA. Ojo, este `null` es
 * DISTINTO del `null` de `TemaContent.fuentePar/forma` (que ahí significa «usar el default») — acá
 * significa «el diseño no lo especificó», y por eso `validarPreset` lo trata como incompleto. Al
 * escribir (`mergePresetEnContent`), la clave decidida pasa por `resolverFuentePar`/`resolverForma`,
 * que normalizan la canónica (`'editorial'`/`'suave'`) a `null` — el mismo `null` que ya usa el
 * picker del panel para "sin override" (§ fuentes.ts, § formas.ts).
 *
 * `variantes`: sección (o banda estructural como `featured`/`trustBadges`) → clave de variante
 * deseada. Tipado LIBRE a propósito (no `Partial<Record<SeccionKey,…>>`): registra la intención
 * COMPLETA del diseño, incluidas secciones sin slot hoy, para que `validarPreset` la nombre en vez
 * de que TypeScript la descarte en silencio.
 *
 * `esquemas`: bandaId (de `BANDA_IDS`) → esquema deseado. `orden`: la secuencia de bandaId deseada.
 */
export interface PresetTema {
  clave: string;
  label: string;
  raices: { fondo: string; tinta: string; acento: string };
  fuentePar: ClaveFuentePar | null;
  forma: ClaveForma | null;
  variantes: Readonly<Record<string, string>>;
  esquemas: Readonly<Partial<Record<BandaId, ClaveEsquema>>>;
  orden: readonly string[];
}

/** Lo que le falta a un preset para poder aplicarse, por REGLA (§3 a-d) y por NOMBRE. */
export interface FaltanteTema {
  regla: 'fuentePar' | 'forma' | 'variante' | 'esquema' | 'orden';
  detalle: string;
}

/**
 * Valida un preset contra el contrato REAL — nunca contra lo que el diseño QUISO decir. Devuelve la
 * lista de faltantes (vacía = preset COMPLETO, aplicable). NUNCA lanza; `aplicarPreset` es quien
 * decide qué hacer con el resultado (§4).
 *
 *  a) cada variante pedida existe en las `claves` de esa sección en el REGISTRY;
 *  b) cada banda del mapa de esquemas existe en BANDA_IDS, y cada esquema en su set cerrado;
 *  c) cada id del `orden` existe en BANDA_IDS (atrapa las bandas inexistentes, p. ej. PATIO);
 *  d) el par y la forma están decididos y en sus sets cerrados.
 */
export function validarPreset(preset: PresetTema): FaltanteTema[] {
  const faltantes: FaltanteTema[] = [];

  // (d) par y forma — `null` (sin decidir) o fuera del set cerrado.
  if (preset.fuentePar === null || !(CLAVES_FUENTES as readonly string[]).includes(preset.fuentePar)) {
    faltantes.push({
      regla: 'fuentePar',
      detalle: `${preset.clave} no tiene un par tipográfico decidido (fuentePar=${JSON.stringify(preset.fuentePar)})`,
    });
  }
  if (preset.forma === null || !(CLAVES_FORMAS as readonly string[]).includes(preset.forma)) {
    faltantes.push({
      regla: 'forma',
      detalle: `${preset.clave} no tiene una forma decidida (forma=${JSON.stringify(preset.forma)})`,
    });
  }

  // (a) variantes — la sección tiene que declarar `variantes` en el REGISTRY, y la clave pedida
  // tiene que estar en su set cerrado.
  const registro = REGISTRY as Record<string, SeccionDef | undefined>;
  for (const [seccion, clave] of Object.entries(preset.variantes)) {
    const def = registro[seccion];
    const claves = def?.variantes?.claves;
    if (!claves) {
      faltantes.push({
        regla: 'variante',
        detalle: `${preset.clave} pide \`${seccion}·${clave}\` y la sección \`${seccion}\` no declara variantes en el REGISTRY`,
      });
    } else if (!claves.includes(clave)) {
      faltantes.push({
        regla: 'variante',
        detalle: `${preset.clave} pide \`${seccion}·${clave}\` y esa clave no existe (claves de \`${seccion}\`: ${claves.join(', ')})`,
      });
    }
  }

  // (b) esquemas — banda conocida (BANDA_IDS) y esquema del set cerrado.
  const bandaIds: readonly string[] = BANDA_IDS;
  for (const [banda, esquema] of Object.entries(preset.esquemas)) {
    if (!bandaIds.includes(banda)) {
      faltantes.push({
        regla: 'esquema',
        detalle: `${preset.clave} asigna esquema a \`${banda}\`, que no existe en BANDA_IDS`,
      });
    } else if (!ESQUEMAS_VALIDOS.includes(esquema as ClaveEsquema)) {
      faltantes.push({
        regla: 'esquema',
        detalle: `${preset.clave} asigna \`${banda}·${String(esquema)}\`, y ese esquema no existe (set: ${ESQUEMAS_VALIDOS.join(', ')})`,
      });
    }
  }

  // (c) orden — cada id tiene que existir en BANDA_IDS. Es lo que atrapa las bandas inexistentes
  // (p. ej. PATIO con `banner`/`faq`).
  for (const id of preset.orden) {
    if (!bandaIds.includes(id)) {
      faltantes.push({
        regla: 'orden',
        detalle: `${preset.clave} incluye \`${id}\` en el orden y no existe en BANDA_IDS`,
      });
    }
  }

  return faltantes;
}

/** ¿Está el preset completo (aplicable HOY)? Atajo de `validarPreset(preset).length === 0`. */
export function presetCompleto(preset: PresetTema): boolean {
  return validarPreset(preset).length === 0;
}

/**
 * Consulta DERIVADA (no una segunda lista): de un catálogo de presets, cuáles están completos hoy.
 * Es la respuesta a «¿qué themes están listos para aplicarse?» sin adivinar — sale de la MISMA
 * validación que `aplicarPreset` corre antes de escribir.
 */
export function temasCompletos(presets: readonly PresetTema[] = PRESETS): readonly PresetTema[] {
  return presets.filter(presetCompleto);
}

/**
 * EL MERGE QUIRÚRGICO — puro, sin DB. Calcula el `content` PUBLICADO resultante de aplicar `preset`
 * sobre el `content` actual. Es la mitad TESTEABLE de `aplicarPreset` (§4, `site-content-write.ts`),
 * separada por el mismo criterio que `aplicarAjusteInventario`/`aplicarPatchProducto`: la lógica
 * vive donde se puede afirmar sin una base real; la transacción es un envoltorio delgado.
 *
 * INVARIANTE (la promesa del runbook): NUNCA toca un texto ni una imagen del dueño. Sólo escribe
 * `tema` (raíces + par + forma, reemplazado entero — son composición, no contenido), `esquemas` y
 * `orden` (reemplazados enteros, por la misma razón), y el campo `variante` DENTRO de cada sección
 * afectada — preservando cualquier otro campo que esa sección ya tuviera (`{ ...prev, variante }`).
 * Ninguna otra clave de `content` se toca.
 *
 * NO VALIDA — asume que `preset` ya pasó `validarPreset` sin faltantes. Escribir con un preset
 * incompleto (una `variante` que no exista, p. ej.) dejaría esa clave en el `content` igual: la
 * guarda es responsabilidad de `aplicarPreset`, que llama a `mergePresetEnContent` sólo si
 * `validarPreset` dio `[]`.
 *
 * PROPIEDAD CONOCIDA, no un olvido: no hay guarda contra reaplicar un preset DISTINTO sobre un
 * `content` que un operador ya afinó a mano (§4) — hoy el dueño nunca compone, así que no hace
 * falta, y no se construye acá.
 */
export function mergePresetEnContent(content: Record<string, unknown>, preset: PresetTema): Record<string, unknown> {
  const out: Record<string, unknown> = { ...content };

  out.tema = {
    fondo: preset.raices.fondo,
    tinta: preset.raices.tinta,
    acento: preset.raices.acento,
    fuentePar: resolverFuentePar(preset.fuentePar),
    forma: resolverForma(preset.forma),
  };
  out.esquemas = { ...preset.esquemas };
  out.orden = [...preset.orden];

  for (const [seccion, variante] of Object.entries(preset.variantes)) {
    const prev = esObj(out[seccion]) ? out[seccion] : {};
    out[seccion] = { ...prev, variante };
  }

  return out;
}

// ── Los cinco themes del diseño, tal como se declararon ──────────────────────────────────────────
// Los datos van embebidos acá porque el diseño vive fuera de este repo. Cada uno registra la
// intención COMPLETA de la entrega (las 5 columnas de variante: hero · featured · brandStory ·
// presentaciones · subscriptionCTA), aun sabiendo que `featured`/`brandStory`/`subscriptionCTA` no
// tienen dónde aplicarse hoy — `validarPreset` los nombra, no se omiten en silencio.

export const PLIEGO: PresetTema = {
  clave: 'PLIEGO',
  label: 'Pliego',
  raices: { fondo: '#f6f1e6', tinta: '#17120e', acento: '#b3200f' },
  fuentePar: 'robusta',   // Oswald/Archivo — confirmado en fuentes.ts
  forma: 'recta',         // confirmado en formas.ts
  variantes: {
    hero: 'marquesina',
    featured: 'tabla',
    brandStory: 'hilo',
    presentaciones: 'chips',
    subscriptionCTA: 'ticket',
  },
  esquemas: {
    featured: 'crema',
    brandStory: 'superficie',
    presentaciones: 'oscuro',
    subscriptionCTA: 'acento',
  },
  // hero → presentaciones → featured → brandStory → subscriptionCTA → trustBadges (dado tal cual;
  // el diseño no incluyó `testimonials` en esta secuencia — no se agrega de más).
  orden: ['hero', 'presentaciones', 'featured', 'brandStory', 'subscriptionCTA', 'trustBadges'],
};

export const CORTE: PresetTema = {
  clave: 'CORTE',
  label: 'Corte',
  raices: { fondo: '#efece6', tinta: '#0c0b0a', acento: '#a3643a' },
  fuentePar: 'moderno',   // Sora/Inter
  forma: 'minima',
  variantes: {
    hero: 'media',
    featured: 'grilla',
    brandStory: 'columnas',
    presentaciones: 'mosaico',
    subscriptionCTA: 'linea',
  },
  esquemas: {
    trustBadges: 'oscuro',
    featured: 'oscuro',
    brandStory: 'oscuro',
    presentaciones: 'superficie',
    subscriptionCTA: 'crema',
  },
  // «usa el default de hoy, sin reordenar» (§2) — el mismo ORDEN_DEFAULT que ya usa Nayoli.
  orden: ORDEN_DEFAULT,
};

export const PATIO: PresetTema = {
  clave: 'PATIO',
  label: 'Patio',
  raices: { fondo: '#fdf6e9', tinta: '#2a1c10', acento: '#c8662b' },
  fuentePar: 'cercano',   // Quicksand/Mulish
  forma: 'suave',         // elección EXPLÍCITA de la canónica — no "sin decidir" (§ docstring de PresetTema)
  variantes: {
    hero: 'collage',
    featured: 'grilla',
    brandStory: 'columnas',
    presentaciones: 'chips',
    subscriptionCTA: 'ticket',
  },
  esquemas: {
    trustBadges: 'superficie',
    featured: 'superficie',
    brandStory: 'crema',
    presentaciones: 'acento',
    subscriptionCTA: 'oscuro',
  },
  // El spec SÓLO dio dos bandas inexistentes (`banner`, `faq`) para PATIO, no la secuencia completa
  // (a diferencia de PLIEGO/VETA, que sí vienen íntegras). No se INVENTA dónde irían: se usa el
  // orden canónico de las 7 reales y se agregan las dos inexistentes AL FINAL, sólo para ejercer la
  // regla (c) — esto NO es el diseño real de PATIO, que sigue sin especificar. Reportado como UNKNOWN.
  orden: [...ORDEN_DEFAULT, 'banner', 'faq'],
};

export const VETA: PresetTema = {
  clave: 'VETA',
  label: 'Veta',
  raices: { fondo: '#16120e', tinta: '#080605', acento: '#d98324' },
  fuentePar: 'tecnico',   // IBM Plex Mono/Sans
  forma: 'minima',
  variantes: {
    hero: 'curtina',      // = la canónica de hero; VÁLIDA hoy
    featured: 'mosaico',
    brandStory: 'bento',
    presentaciones: 'indice', // VÁLIDA hoy (existe en presentaciones.variantes.claves)
    subscriptionCTA: 'tarjeta',
  },
  // El spec describe el mapa de VETA en prosa contradictoria («las SEIS bandas con esquema»
  // seguido de «dark-first: sin esquema en todas, una banda saca tarjetas blancas»), sin dar los
  // pares banda→esquema concretos que sí trajeron los otros cuatro themes. No se INVENTA una
  // asignación: queda VACÍO (= todas las bandas caen a su token canónico), y se reporta como UNKNOWN
  // — el diseño de VETA necesita esta tabla antes de poder darse por completo en este eje.
  esquemas: {},
  orden: ['hero', 'featured', 'brandStory', 'presentaciones', 'subscriptionCTA', 'trustBadges'],
};

export const VITRINA: PresetTema = {
  clave: 'VITRINA',
  label: 'Vitrina',
  raices: { fondo: '#ffffff', tinta: '#12100f', acento: '#6f6558' },
  // El par y la forma de VITRINA NO vinieron en la entrega («sin definir» — §2). NO se inventan:
  // quedan `null` (= SIN DECIDIR, § docstring de PresetTema), y `validarPreset` los reporta como
  // faltantes por nombre (fuentePar/forma).
  fuentePar: null,
  forma: null,
  variantes: {
    hero: 'ficha',        // VÁLIDA hoy (existe en hero.variantes.claves)
    featured: 'grilla',
    brandStory: 'hilo',
    presentaciones: 'indice', // VÁLIDA hoy
    subscriptionCTA: 'linea',
  },
  esquemas: {
    trustBadges: 'crema',
    featured: 'crema',
    brandStory: 'superficie',
    presentaciones: 'oscuro',
    subscriptionCTA: 'superficie',
  },
  // El spec no dio el orden de VITRINA. Se usa el canónico (ORDEN_DEFAULT) como placeholder NEUTRO
  // —no inventa una secuencia que el diseño no propuso, y no introduce una falla nueva (rule (c)
  // siempre pasa contra BANDA_IDS)—. Reportado como UNKNOWN, igual que el resto de VITRINA.
  orden: ORDEN_DEFAULT,
};

/**
 * EL PRESET DE ARRANQUE — el único que valida COMPLETO hoy (§5). No es un theme del catálogo de
 * diseño: es Nayoli, expresada explícitamente como preset, usando SÓLO capacidades que el REGISTRY
 * ya soporta — `hero·ficha` y `presentaciones·indice` (las dos únicas variantes reales que existen
 * hoy fuera de la canónica), `brandStory` intacta (no tiene slot: no se le pide nada), un par de
 * esquemas reales, y el par/forma explícitos (`editorial`/`suave`, la propia canónica de Nayoli).
 * Sirve para demostrar que `validarPreset` ACEPTA lo que sí existe, no sólo que rechaza lo que no.
 */
export const ARRANQUE: PresetTema = {
  clave: 'ARRANQUE',
  label: 'Arranque',
  raices: { fondo: RAICES_DEFECTO.fondo, tinta: RAICES_DEFECTO.tinta, acento: RAICES_DEFECTO.acento },
  fuentePar: 'editorial',
  forma: 'suave',
  variantes: {
    hero: 'ficha',
    presentaciones: 'indice',
    // brandStory: sin entrada — no tiene slot, así que "canónica" es simplemente no pedirle nada.
  },
  esquemas: {
    featured: 'crema',
    subscriptionCTA: 'acento',
  },
  orden: ORDEN_DEFAULT,
};

/** El catálogo completo — los cinco themes del diseño + el de arranque. */
export const PRESETS: readonly PresetTema[] = [PLIEGO, CORTE, PATIO, VETA, VITRINA, ARRANQUE];
