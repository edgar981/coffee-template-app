// EL ESTILO POR ELEMENTO (§ EDITOR-TIENDA-BARRA-FLOTANTE-1, docs/editor-tienda/REDISENO.md § 5/§ 8,
// slice 7 del plan de rediseño). Módulo PURO —sin DOM, sin React, sin `server-only`— que declara:
//
//   (a) QUÉ elementos de texto de QUÉ sección pueden llevar estilo propio (`ELEMENTOS_ESTILO`, la
//       fuente ÚNICA que alimenta tanto `REGISTRY.<seccion>.estilos` —de dónde sale el resolver—
//       como la barra flotante —de dónde sale "¿este campo es estilizable?"—, para que las dos listas
//       nunca puedan divergir: una se DERIVA de la otra, nunca se repiten a mano);
//   (b) la FORMA resuelta de un estilo (`EstiloElementoResuelto`) y su resolver SOFT
//       (`resolverEstiloElemento`/`resolverEstilosSeccion`), gemelos de `resolverVariante` en
//       `site-content-defaults.ts` — mismo criterio: nunca lanza, lo que no valida cae a `null` (=
//       "por defecto", nunca a un valor inventado);
//   (c) los traductores a CSS (`fontFamilyDeEstilo`/`fontSizeDeEstilo`/`colorCSSDeEstilo`/
//       `textAlignDeEstilo`/`estiloInlineDeElemento`) que los componentes del storefront (Hero*)
//       llaman para construir su `style`, y que la barra flotante (`EditorPuenteVivo.tsx`) y el
//       control del panel (`components/admin/editor/EstiloElementoControles.tsx`) llaman para
//       mostrar el valor actual.
//
// SIN el objeto de estilo (todo `null`) → NINGÚN traductor emite una clave de `style` → el elemento
// sigue rindiendo EXACTAMENTE su clase Tailwind de hoy — byte-idéntico. Es la MISMA garantía que
// `fontSizeDisplay` (escala-display.ts) ya fija para `tema.escalaDisplay`: "ausente → `undefined` →
// el llamador no toca `style`", sólo que acá son CUATRO ejes en vez de uno.

import { CLAVES_FUENTES, parDeFuentePar, fontFamilyDeRol, type ClaveFuentePar, type RolTipografico } from './fuentes';
import {
  esRolColorElemento, varDeRolColorElemento, claveDerivadaDeRolColorElemento, contraste,
  ROLES_COLOR_ELEMENTO, type RolColorElemento, type PaletaDerivada,
} from './palette-derive';

const ROLES_COLOR_ELEMENTO_INTERNO: readonly RolColorElemento[] = ROLES_COLOR_ELEMENTO.map((r) => r.clave);

// ─── (a) QUÉ ES ESTILIZABLE — la fuente ÚNICA, sección→elemento→metadata ──────────────────────────
//
// El "tipo" de un elemento decide DOS cosas: qué ESCALA de tamaño usa (`ESCALA_TAMANO`, abajo — un
// titular y una leyenda no viven en el mismo rango de píxeles) y qué ROL TIPOGRÁFICO tiene por
// naturaleza (`ROL_TIPOGRAFICO_POR_TIPO` — un titular es DISPLAY, un botón es CUERPO), que a su vez
// decide qué fuente es "Por defecto" (§ `fontFamilyDeEstilo`).
//
// SÓLO `hero` declara elementos hoy. `marquesina.texto` (la frase de la marquesina del hero·sticky,
// nombrada en el spec de este slice) QUEDA FUERA A PROPÓSITO — desviación medida, no omisión: su
// render vive en `components/storefront/home/MarquesinaMotor.tsx`
// (`MarquesinaFraseMotor`, el `<CampoEditable campo={campo}>` del loop), un archivo FUERA de
// `touches:` de este slice. Sin poder tocarlo, cablear un estilo que nunca se aplica visualmente
// sería una barra flotante que miente —cambia algo que no cambia nada en la página—, y ese costo es
// peor que no ofrecer el control. Ver DECISIONS.md para el seguimiento (coined
// `EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1`).
export type TipoElementoEstilo = 'titular' | 'subtitulo' | 'leyenda' | 'boton';

export interface MetaElementoEstilo {
  tipo: TipoElementoEstilo;
  /** El nombre en palabras que la barra flotante/el panel usan para este elemento (p. ej. "Titular",
   *  "Botón secundario") — nunca el nombre técnico del campo. */
  label: string;
}

/** Sección → elemento → metadata. Es la ÚNICA lista a mano de este eje: `REGISTRY.<seccion>.estilos`
 *  (site-content-defaults.ts) se DERIVA de `Object.keys(ELEMENTOS_ESTILO[seccion])`, nunca al revés
 *  — así "qué elemento existe" y "qué elemento resuelve el resolver" no pueden divergir (la misma
 *  clase de defecto que ya mordió dos veces en este repo, § CLAUDE.md "cuando dos declaraciones
 *  describen el mismo conjunto…"). */
export const ELEMENTOS_ESTILO: Record<string, Record<string, MetaElementoEstilo>> = {
  hero: {
    titulo: { tipo: 'titular', label: 'Titular' },
    subtitulo: { tipo: 'subtitulo', label: 'Subtítulo' },
    fraseAlPie: { tipo: 'leyenda', label: 'Leyenda' },
    ctaPrimarioLabel: { tipo: 'boton', label: 'Botón principal' },
    ctaSecundarioLabel: { tipo: 'boton', label: 'Botón secundario' },
  },
};

/** Los nombres de elemento de UNA sección, en el orden declarado — lo que `REGISTRY.<seccion>.
 *  estilos` consume directo. `[]` para una sección sin entrada en `ELEMENTOS_ESTILO` (nunca lanza). */
export function elementosEstiloDeSeccion(seccion: string): string[] {
  return Object.keys(ELEMENTOS_ESTILO[seccion] ?? {});
}

/** La metadata de un elemento (`seccion.campo`), o `null` si no es estilizable — el gate que decide
 *  si la barra flotante aparece para un campo dado. */
export function metaElementoEstilo(seccion: string, elemento: string): MetaElementoEstilo | null {
  return ELEMENTOS_ESTILO[seccion]?.[elemento] ?? null;
}

const ROL_TIPOGRAFICO_POR_TIPO: Record<TipoElementoEstilo, RolTipografico> = {
  titular: 'titulo',
  subtitulo: 'cuerpo',
  leyenda: 'cuerpo',
  boton: 'cuerpo',
};

// ─── (b) LA FORMA — tamaño, alineación, letra, color, y el resolver SOFT ───────────────────────────

export const TAMANOS_ELEMENTO = ['pequeno', 'mediano', 'grande', 'muy-grande', 'enorme'] as const;
export type TamanoElemento = (typeof TAMANOS_ELEMENTO)[number];

/** El nombre en palabras de cada paso — "amigable para quien no diseña" (§ REDISENO.md § 2). */
export const LABEL_TAMANO_ELEMENTO: Record<TamanoElemento, string> = {
  pequeno: 'Pequeño',
  mediano: 'Mediano',
  grande: 'Grande',
  'muy-grande': 'Muy grande',
  enorme: 'Enorme',
};

export const ALINEACIONES_ELEMENTO = ['izquierda', 'centro', 'derecha'] as const;
export type AlineacionElemento = (typeof ALINEACIONES_ELEMENTO)[number];

const TEXT_ALIGN_POR_ALINEACION: Record<AlineacionElemento, string> = {
  izquierda: 'left',
  centro: 'center',
  derecha: 'right',
};

/**
 * La ESCALA de `font-size` por tipo de elemento × paso con nombre (§ REDISENO.md § 5: "mapeados a
 * una escala por tipo de elemento y ajustados al ancho del dispositivo"). Cada valor es un
 * `clamp(piso, preferido-en-vw, techo)` — el AJUSTE AL ANCHO lo hace el propio CSS `clamp()` (el
 * mismo mecanismo que `escala-display.ts` ya usa para `tema.escalaDisplay`), no JS de breakpoints:
 * un `clamp()` no necesita re-medir el viewport ni re-renderizar al rotar el teléfono.
 *
 * El techo de `titular.enorme` es LITERALMENTE el `CLAMP_XL` de `escala-display.ts` ('amplia') —no
 * una segunda medición del mismo tamaño máximo—: es el titular más grande que este repo ya calibró
 * contra el prototipo (`docs/prototipos/cafeone/`), así que "Enorme" en la barra flotante y
 * "escalaDisplay: 'amplia'" del tema llegan al MISMO techo por una razón de diseño, no por
 * coincidencia. Los demás pasos/tipos son una progresión monótona razonable alrededor del tamaño de
 * HOY de cada rol (medido contra las clases Tailwind de los 4 heros/el subtítulo/CTA, § los
 * componentes): no pretenden ser una medición exacta de cada paso, sólo una escalera sin saltos ni
 * retrocesos — lo que el test de monotonía de este archivo afirma.
 */
const ESCALA_TAMANO: Record<TipoElementoEstilo, Record<TamanoElemento, string>> = {
  titular: {
    pequeno: 'clamp(28px, 4vw, 34px)',
    mediano: 'clamp(34px, 4.5vw, 44px)',
    grande: 'clamp(40px, 5.5vw, 56px)',
    'muy-grande': 'clamp(52px, 7vw, 96px)',
    enorme: 'clamp(72px, 9vw, 168px)', // = CLAMP_XL de escala-display.ts ('amplia')
  },
  subtitulo: {
    pequeno: 'clamp(13px, 1.2vw, 14px)',
    mediano: 'clamp(15px, 1.4vw, 16px)',
    grande: 'clamp(17px, 1.6vw, 19px)',
    'muy-grande': 'clamp(19px, 1.9vw, 22px)',
    enorme: 'clamp(22px, 2.4vw, 28px)',
  },
  leyenda: {
    pequeno: 'clamp(11px, 1vw, 12px)',
    mediano: 'clamp(12px, 1.1vw, 13px)',
    grande: 'clamp(13px, 1.2vw, 15px)',
    'muy-grande': 'clamp(15px, 1.4vw, 17px)',
    enorme: 'clamp(17px, 1.7vw, 20px)',
  },
  boton: {
    pequeno: 'clamp(12px, 1vw, 13px)',
    mediano: 'clamp(13px, 1.1vw, 14px)',
    grande: 'clamp(14px, 1.3vw, 16px)',
    'muy-grande': 'clamp(16px, 1.5vw, 18px)',
    enorme: 'clamp(18px, 1.8vw, 21px)',
  },
};

/**
 * La LETRA elegida para un elemento. Tres formas (§ REDISENO.md § 5):
 *   - `null` — "Por defecto": la fuente del ROL correcto (titulo/cuerpo) del PAR ACTIVO del tema.
 *   - `'otra-del-par'` — la fuente del rol CONTRARIO del MISMO par activo (un titular pidiendo la
 *     fuente de cuerpo del par, o viceversa) — nunca necesita cargar una familia nueva: las DOS
 *     fuentes del par activo ya viajan en el `<link>` que el layout inyecta para `tema.fuentePar`
 *     (`urlGoogle(par)` pide las dos familias en una sola URL).
 *   - una `ClaveFuentePar` — una fuente de la colección curada completa (`fuentes.ts`), resuelta al
 *     rol de ESTE elemento (un titular que elige 'robusta' recibe `Oswald`, el display de ese par,
 *     no su cuerpo). Nunca un campo libre (§ REDISENO.md § 5, "nunca un campo de fuente libre").
 */
export type FuenteElemento = ClaveFuentePar | 'otra-del-par' | null;

/** El color de un elemento: `null` ("Por defecto": lo que la zona ya pide — claro sobre la foto,
 *  tinta sobre el papel; el llamador no emite ningún `color`), un `RolColorElemento` (sigue a la
 *  paleta — § REDISENO.md § 5, "se guarda el rol"), o `custom:#rrggbb` (un hex fijo, "Avanzado ›
 *  Personalizado" — NO sigue a la paleta, por eso vive en Avanzado). */
export type ColorElemento = RolColorElemento | `custom:${string}` | null;

export interface EstiloElementoResuelto {
  fuente: FuenteElemento;
  tamano: TamanoElemento | null;
  color: ColorElemento;
  alinear: AlineacionElemento | null;
}

/** El estilo "sin ningún override" — los CUATRO ejes en `null`. Es el DEFAULT de todo elemento
 *  estilizable (§ `DEFAULTS.hero.estilos`, site-content-defaults.ts) y lo que "Quitar" en la barra
 *  flotante produce (los cuatro mensajes mandan `''`, que `resolverEstiloElemento` normaliza a
 *  `null` igual que ausente — mismo criterio que el resto del repo trata `''` como "sin dato"). */
export const ESTILO_ELEMENTO_VACIO: EstiloElementoResuelto = { fuente: null, tamano: null, color: null, alinear: null };

const CLAVES_FUENTES_SET = new Set<string>(CLAVES_FUENTES);
const HEX6_CUSTOM = /^custom:#[0-9a-fA-F]{6}$/;

function esObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function resolverFuenteElemento(v: unknown): FuenteElemento {
  if (v === 'otra-del-par') return 'otra-del-par';
  return typeof v === 'string' && CLAVES_FUENTES_SET.has(v) ? (v as ClaveFuentePar) : null;
}

function resolverTamanoElemento(v: unknown): TamanoElemento | null {
  return typeof v === 'string' && (TAMANOS_ELEMENTO as readonly string[]).includes(v) ? (v as TamanoElemento) : null;
}

function resolverAlineacionElemento(v: unknown): AlineacionElemento | null {
  return typeof v === 'string' && (ALINEACIONES_ELEMENTO as readonly string[]).includes(v) ? (v as AlineacionElemento) : null;
}

function resolverColorElemento(v: unknown): ColorElemento {
  if (typeof v !== 'string' || v.trim() === '') return null;
  if (esRolColorElemento(v)) return v;
  return HEX6_CUSTOM.test(v) ? (v as `custom:${string}`) : null;
}

/** El resolver SOFT de UN elemento — gemelo de `resolverVariante` (site-content-defaults.ts): nunca
 *  lanza, lo que no valida cae a `null` (nunca a un valor inventado). `v` ausente, basura, o un
 *  objeto con subcampos basura → `ESTILO_ELEMENTO_VACIO` (o la mezcla parcial que SÍ valida). */
export function resolverEstiloElemento(v: unknown): EstiloElementoResuelto {
  const o = esObj(v) ? v : {};
  return {
    fuente: resolverFuenteElemento(o.fuente),
    tamano: resolverTamanoElemento(o.tamano),
    color: resolverColorElemento(o.color),
    alinear: resolverAlineacionElemento(o.alinear),
  };
}

/** El resolver SOFT de TODA una sección — gemelo de `resolverItems` (site-content-defaults.ts) a
 *  escala de mapa: para cada `clave` DECLARADA (nunca las que el guardado trajera de más — un
 *  elemento que la sección ya no declara no puede colarse), resuelve su estilo. Devuelve SIEMPRE
 *  una entrada por clave declarada (nunca `undefined`), así que un componente puede leer
 *  `hero.estilos.titulo` sin `?.`. */
export function resolverEstilosSeccion(stored: unknown, claves: readonly string[]): Record<string, EstiloElementoResuelto> {
  const st = esObj(stored) ? stored : {};
  const out: Record<string, EstiloElementoResuelto> = {};
  for (const clave of claves) out[clave] = resolverEstiloElemento(st[clave]);
  return out;
}

// ─── (c) LOS TRADUCTORES A CSS ──────────────────────────────────────────────────────────────────────

/** La familia CSS de override, o `undefined` si no hay ninguna que aplicar ("Por defecto": la
 *  clase Tailwind de siempre ya pinta la fuente correcta, sin que este módulo tenga que repetirla). */
export function fontFamilyDeEstilo(
  estilo: EstiloElementoResuelto,
  tipo: TipoElementoEstilo,
  fuenteParActivo: ClaveFuentePar | null,
): string | undefined {
  if (estilo.fuente === null) return undefined;
  const rolPropio = ROL_TIPOGRAFICO_POR_TIPO[tipo];
  if (estilo.fuente === 'otra-del-par') {
    const parActivo = parDeFuentePar(fuenteParActivo);
    const rolContrario: RolTipografico = rolPropio === 'titulo' ? 'cuerpo' : 'titulo';
    return fontFamilyDeRol(parActivo, rolContrario);
  }
  return fontFamilyDeRol(parDeFuentePar(estilo.fuente), rolPropio);
}

/** El `font-size` de override, o `undefined` sin `tamano` declarado. */
export function fontSizeDeEstilo(estilo: EstiloElementoResuelto, tipo: TipoElementoEstilo): string | undefined {
  if (estilo.tamano === null) return undefined;
  return ESCALA_TAMANO[tipo][estilo.tamano];
}

/** El `color` CSS de override — `var(--sf-<rol>)` (sigue a la paleta) o el hex crudo (Personalizado),
 *  o `undefined` sin `color` declarado. */
export function colorCSSDeEstilo(estilo: EstiloElementoResuelto): string | undefined {
  if (estilo.color === null) return undefined;
  if (estilo.color.startsWith('custom:')) return estilo.color.slice('custom:'.length);
  return esRolColorElemento(estilo.color) ? `var(${varDeRolColorElemento(estilo.color)})` : undefined;
}

/** El `text-align` de override, o `undefined` sin `alinear` declarado. */
export function textAlignDeEstilo(estilo: EstiloElementoResuelto): string | undefined {
  return estilo.alinear === null ? undefined : TEXT_ALIGN_POR_ALINEACION[estilo.alinear];
}

/**
 * El `style` COMPLETO de un elemento — sólo las claves que SÍ tienen override (§ los cuatro
 * traductores arriba). Con `estilo === ESTILO_ELEMENTO_VACIO` (o cualquier estilo todo-`null`)
 * devuelve `{}`: spreadearlo sobre un `style` existente no cambia ni un byte — la garantía de
 * byte-identidad de este slice.
 */
export function estiloInlineDeElemento(
  estilo: EstiloElementoResuelto,
  tipo: TipoElementoEstilo,
  fuenteParActivo: ClaveFuentePar | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  const fontFamily = fontFamilyDeEstilo(estilo, tipo, fuenteParActivo);
  if (fontFamily) out.fontFamily = fontFamily;
  const fontSize = fontSizeDeEstilo(estilo, tipo);
  if (fontSize) out.fontSize = fontSize;
  const color = colorCSSDeEstilo(estilo);
  if (color) out.color = color;
  const textAlign = textAlignDeEstilo(estilo);
  if (textAlign) out.textAlign = textAlign;
  return out;
}

/** Las claves de `ClaveFuentePar` REFERENCIADAS por los estilos de una sección (nunca `'otra-del-
 *  par'`, que no necesita cargar nada — § el docstring de `FuenteElemento`), para que el storefront
 *  pueda inyectar el `<link>` de Google Fonts de CADA par referenciado, no sólo el activo
 *  (`tema.fuentePar`) — "la letra elegida se carga en la tienda pública… sin esperar a publicar",
 *  § REDISENO.md § 5. Sin duplicados; orden de primera aparición. */
export function paresFuenteReferenciados(estilos: Record<string, EstiloElementoResuelto>): ClaveFuentePar[] {
  const out: ClaveFuentePar[] = [];
  const vistos = new Set<string>();
  for (const e of Object.values(estilos)) {
    if (e.fuente && e.fuente !== 'otra-del-par' && !vistos.has(e.fuente)) {
      vistos.add(e.fuente);
      out.push(e.fuente);
    }
  }
  return out;
}

// ─── EL FILTRO "SE LEEN BIEN SOBRE EL FONDO DE ESA ZONA" (§ REDISENO.md § 5) ────────────────────────
//
// "Sólo los que se leen bien" —SIN mostrar un aviso de contraste (decisión del owner, 2026-10-02)—:
// la LISTA que se ofrece ya viene recortada; no hay una advertencia visible sobre la opción elegida.
// Es un FILTRO silencioso, no una advertencia.

const UMBRAL_LEGIBLE = 3; // relajado a propósito: roles decorativos (tostado/superficie) no tienen
// por qué pasar AA (4.5) para "leerse"; el piso real de TEXTO de lectura ya lo garantiza
// `pisoContraste` en el propio motor. Documentado para que un ajuste futuro mida contra esto, no
// contra un número sin origen.

function hexDeRolColorElemento(derivado: PaletaDerivada, rol: RolColorElemento): string {
  return derivado[claveDerivadaDeRolColorElemento(rol)];
}

/**
 * Los roles del catálogo de SEIS que alcanzan `UMBRAL_LEGIBLE` de contraste contra el fondo real de
 * la zona —`derivado.tinta` para una zona OSCURA, `derivado.fondo` para una CLARA (§ `oscura`, que
 * el llamador deriva de `bandaOscuraCanonica('hero', variante)`, site-content-defaults.ts — fuera de
 * este módulo para no crear un ciclo de imports: ese archivo YA importa `estilo-elemento.ts` para el
 * resolver, así que este módulo no puede importarlo de vuelta)—. `derivado` es la paleta YA derivada
 * del tenant (`derivarPaleta`, palette-derive.ts) — este módulo no la deriva, sólo filtra sobre ella.
 */
export function rolesColorLegibles(derivado: PaletaDerivada, oscura: boolean): RolColorElemento[] {
  const fondoZona = oscura ? derivado.tinta : derivado.fondo;
  return ROLES_COLOR_ELEMENTO_INTERNO.filter(
    (r) => contraste(hexDeRolColorElemento(derivado, r), fondoZona) >= UMBRAL_LEGIBLE,
  );
}
