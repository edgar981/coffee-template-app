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
// linea, collage, bento) NO EXISTEN todavía en el REGISTRY. QUÉ SECCIÓN declara `variantes` y con
// qué claves NO se enumera acá: se lee en `REGISTRY.<seccion>.variantes.claves`
// (`site-content-defaults.ts`), porque cada slice que construye una composición nueva mueve esa
// lista, y una copia congelada de "quién tiene slot" vence sola — medido dos veces sobre ESTE MISMO
// párrafo (`CORTE-PRESENTACIONES-RIEL-1`, `DECISIONS.md`: la afirmación de que `subscriptionCTA`
// no tenía slot, y la lista de claves de `brandStory`, quedaron describiendo un REGISTRY que ya no
// era — § `THEMES-COMENTARIO-SUBSCRIPTIONCTA-VENCIDO-1`, corregido en `CORTE-COMENTARIOS-
// VENCIDOS-1`). `featured`/`trustBadges` ni siquiera son `SeccionKey` (son bandas ESTRUCTURALES sin
// sección en `SiteContentData`, § `site-content-defaults.ts`) — `featured` gana su propio slot desde
// TEMAS-P1-FEATURED-VARIANTES-1, pero en `VARIANTES_ESTRUCTURALES` (el gemelo del REGISTRY para
// bandas sin sección, § site-content-defaults.ts), NO en el REGISTRY mismo; `trustBadges` se deja
// afuera de esa tabla también — ningún preset de acá pide una variante suya (capacidad muerta si se
// declarara sin consumidor). NOTA HISTÓRICA (TEMAS-PRESET-DATO-1): al escribir este comentario el
// spec de esa tanda afirmaba «brandStory acaba de ganar su slot con una clave» y este archivo lo
// contradecía — medido entonces contra el `main` que esa rama tenía como base, que aún no incluía
// `TEMAS-P2-BRANDSTORY-1` (mergeado por separado; la cronología no se reconcilió en este texto al
// fusionarse las dos ramas). Hoy (2026-09-15, TEMAS-P1-FEATURED-VARIANTES-1) el REGISTRY real SÍ
// declara `brandStory.variantes`, así que la frase había quedado vencida — corregida acá, sin tocar
// el REGISTRY (§ doctrina «el REGISTRY no se toca desde acá», que sigue en pie).
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
  REGISTRY, BANDA_IDS, ORDEN_DEFAULT, VARIANTES_ESTRUCTURALES,
  type SeccionDef, type BandaId, type ClaveEsquema,
} from './site-content-defaults';
import { RAICES_DEFECTO, type OrigenTexto, type OrigenAccion } from './palette-derive';
import type { ClaveEscalaDisplay } from './escala-display';

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
 *
 * `origenTexto`/`origenAccion` (§ TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1, OPCIONALES) — la RAÍZ
 * ADITIVA que declara de dónde nace el texto de lectura y la acción primaria del storefront
 * (`EjesPaleta`, `palette-derive.ts`). AUSENTE en un preset = el comportamiento de HOY, byte a
 * byte (el mismo criterio que `fuentePar`/`forma` en `null`, pero acá la ausencia de la CLAVE
 * misma es la forma de "sin declarar" — no un valor `null` que haya que escribir a mano en cada
 * uno de los otros cinco presets). Nace de un acento que es COLOR DE ACCIÓN puro (CORTE, rojo): un
 * acento así no sirve como fuente de texto de lectura ni como tono cálido de botón, así que el
 * preset lo dice explícitamente en vez de que el motor lo asuma para TODOS los clientes.
 *
 * `navTinta`/`navSubtitulo`/`navBadge` (§ CROMO-NAV-FOOTER-TEMATIZABLE-1, OPCIONALES) — los 3 ejes
 * de `CromoContent` (`site-content-defaults.ts`), MISMA familia aditiva que `origenTexto`/
 * `origenAccion`: AUSENTE en un preset = el comportamiento de HOY, byte a byte (`tratamientoNav`
 * deriva el nav; sin sub-encabezado; sin badge). Van a su PROPIA meta (`content.cromo`), no a
 * `content.tema` — ver el docstring de `CromoContent` para el porqué (el guardar/publicar de la
 * paleta reemplaza `tema` entero y los resetearía en silencio si vivieran ahí).
 *
 * `escalaDisplay` (§ TEMAS-ESCALA-DISPLAY-1, OPCIONAL, `lib/config/escala-display.ts`) — la ESCALA
 * de los titulares de DISPLAY (el h1 del hero, el h2 de cada banda de sección). AUSENTE en un
 * preset = `null` = el comportamiento de HOY, byte a byte: cada titular sigue rindiendo su propia
 * clase Tailwind fija (que difiere de un componente a otro — no hay una base común, § el docstring
 * de `escala-display.ts`). Va DENTRO de `content.tema`, no en una meta aparte como `cromo`: es un
 * eje TIPOGRÁFICO, la misma familia que `fuentePar`/`forma`, que ya viven ahí.
 *
 * `bandaOrigenVisible` (§ ORIGEN-BANDA-1, OPCIONAL) — NO CONFUNDIR con `origenTexto`/`origenAccion`
 * de arriba (esos son la raíz de PALETA de la que nace el texto de lectura/la acción primaria; esto
 * es la banda `origen` del home, la sección "El origen" del prototipo). AUSENTE = el comportamiento
 * de HOY, byte a byte (`content.origen.visible` sigue en `false`, § DEFAULTS.origen,
 * site-content-defaults.ts). `mergePresetEnContent` NUNCA escribe texto/imagen de la sección —sólo
 * este booleano—, exactamente como ya hace con `spotlight.visible` cuando `featured` elige esa
 * variante: encender la banda sin poder tocar su copy es lo que hace que el mirador de un preset la
 * muestre con el contenido que YA hubiera en `content.origen` (los DEFAULTS, para un tenant sin
 * fila propia como Nayoli).
 *
 * `bandaMarquesinaVisible` (§ MARQUESINA-BANDA-1, OPCIONAL) — GEMELO exacto de `bandaOrigenVisible`,
 * para la banda `marquesina` (la sección `.marquee` del prototipo, § `MarquesinaContent`). AUSENTE
 * = el comportamiento de HOY, byte a byte (`content.marquesina.visible` sigue en `false`).
 *
 * `heroCtasVisibles`/`heroCueDesliza` (§ TEMAS-HERO-TOGGLES-PRESET-1, OPCIONALES) — NO CONFUNDIR con
 * `bandaOrigenVisible`/`bandaMarquesinaVisible` de arriba (esos ENCIENDEN una banda ENTERA de
 * `BANDA_IDS`); estos dos son los DOS BOOLEANOS que `REGISTRY.hero.booleanos` ya declara DENTRO de
 * la sección `hero` (`ctasVisibles`/`cueDesliza`, § TEMAS-HERO-MEDIA-AGREGADOS-1) — `hero` ya existe
 * y ya se muestra en TODO tenant; lo que faltaba era que un preset pudiera apagar sus CTA y encender
 * su cue "Desliza" sin depender de que el panel del cliente los toque. AUSENTE en un preset = el
 * comportamiento de HOY, byte a byte (`content.hero.ctasVisibles` sigue resolviendo a `true`,
 * `content.hero.cueDesliza` a `false` — los defaults que `resolverSiteContent` ya aplica). La FRASE
 * al pie (`hero.fraseAlPie`) NO tiene su gemelo acá a propósito: es CONTENIDO del tenant (un texto,
 * no una composición), así que ningún preset la siembra — mismo criterio que `mergePresetEnContent`
 * nunca escribe el `titulo`/`lede` de `origen` o el `texto` de `marquesina`.
 *
 * `volverArribaVisible` (§ CROMO-VOLVER-ARRIBA-1, OPCIONAL) — ¿se monta el botón flotante "volver
 * arriba" (gemelo del `.to-top` del prototipo)? AUSENTE = el comportamiento de HOY, byte a byte (el
 * storefront no tiene este chrome, `BackToTop.tsx` rinde `null`). Escribe `content.volverArriba.
 * visible` (`VolverArribaContent`, meta PROPIA — ver su docstring en `site-content-defaults.ts` para
 * el porqué de que NO comparta objeto con `navTinta`/`navSubtitulo`/`navBadge`). CORTE es hoy el
 * ÚNICO preset que lo declara.
 *
 * `rielSocialVisible` (§ CROMO-RIEL-SOCIAL-1, OPCIONAL) — ¿se monta el riel social fijo a la
 * izquierda (gemelo del `.rail` del prototipo)? AUSENTE = el comportamiento de HOY, byte a byte (el
 * storefront no tiene este chrome, `RielSocial.tsx` rinde `null`). Escribe `content.rielSocial.
 * visible` (`RielSocialContent`, meta PROPIA — MISMA razón que `volverArribaVisible`: no comparte
 * objeto ni con `cromo` ni con `volverArriba`). CORTE es hoy el ÚNICO preset que lo declara.
 *
 * `navTratamientoActivo` (§ CROMO-NAV-TRATAMIENTO-1, OPCIONAL) — ¿los links del nav llevan el
 * tratamiento tipográfico del `.nav-link` del prototipo (mayúscula + tracking + un peso, sobre la
 * MISMA sans del par — NO una tercera familia)? AUSENTE = el comportamiento de HOY, byte a byte
 * (`text-sm font-medium`, sin mayúscula ni tracking). Escribe `content.navTratamiento.activo`
 * (`NavTratamientoContent`, meta PROPIA — MISMA razón que `volverArribaVisible`/`rielSocialVisible`:
 * conceptualmente es la misma familia que `navTinta` —ajusta un chrome ya montado, no monta uno
 * nuevo—, pero no puede compartir objeto con `cromo` por la restricción de `touches:` medida contra
 * `cromo-tematizable.test.ts`, ver el docstring de `NavTratamientoContent` en
 * `site-content-defaults.ts`). CORTE es hoy el ÚNICO preset que lo declara.
 *
 * `navWordmarkActivo` (§ CORTE-LOGO-APILADO-1, OPCIONAL) — ¿el wordmark apilado del nav (rama
 * `subtitle` de `Logo.tsx`, ya encendida por `navSubtitulo`) calza el `.wordmark`/`.wordmark small`
 * del prototipo (nombre en mayúscula+tracking+tamaño mayor, sub en la sans del cuerpo muted sin
 * itálica)? AUSENTE = el comportamiento de HOY, byte a byte (nombre sin mayúscula a 22px, sub
 * `font-display` itálico `--sf-tostado-5`). Escribe `content.navWordmark.activo`
 * (`NavWordmarkContent`, meta PROPIA — NO es el mismo eje que `navTratamientoActivo`: aquél trata los
 * LINKS del nav (`.nav-link`), éste el WORDMARK (`.wordmark`), dos elementos del prototipo con sus
 * propios valores medidos — ver el docstring de `NavWordmarkContent` en `site-content-defaults.ts`).
 * CORTE es hoy el ÚNICO preset que lo declara.
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
  origenTexto?: OrigenTexto;
  origenAccion?: OrigenAccion;
  navTinta?: boolean;
  navSubtitulo?: boolean;
  navBadge?: string;
  escalaDisplay?: ClaveEscalaDisplay;
  bandaOrigenVisible?: boolean;
  bandaMarquesinaVisible?: boolean;
  heroCtasVisibles?: boolean;
  heroCueDesliza?: boolean;
  volverArribaVisible?: boolean;
  rielSocialVisible?: boolean;
  navTratamientoActivo?: boolean;
  navWordmarkActivo?: boolean;
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

  // (a) variantes — la clave pedida tiene que declarar `variantes` en alguna de las DOS tablas que
  // pueden dárselas: el REGISTRY (una SECCIÓN, `hero`/`presentaciones`/`brandStory` hoy) o
  // `VARIANTES_ESTRUCTURALES` (una BANDA sin sección, `featured` hoy — TEMAS-P1-FEATURED-VARIANTES-1,
  // § site-content-defaults.ts). Antes sólo se consultaba el REGISTRY, así que TODO pedido de
  // `featured` fallaba con "no declara variantes" sin poder distinguir "la banda no tiene slot" de
  // "esa composición no existe" — el mismo defecto que `TEMAS-P2-BRANDSTORY-1` ya cerró del lado de
  // las secciones. Y la clave pedida tiene que estar en el set cerrado de la tabla que la declare.
  const registro = REGISTRY as Record<string, SeccionDef | undefined>;
  for (const [seccion, clave] of Object.entries(preset.variantes)) {
    const claves = registro[seccion]?.variantes?.claves ?? VARIANTES_ESTRUCTURALES[seccion]?.claves;
    if (!claves) {
      faltantes.push({
        regla: 'variante',
        detalle: `${preset.clave} pide \`${seccion}·${clave}\` y \`${seccion}\` no declara variantes`,
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
 * `tema` (raíces + par + forma + los dos ejes de origen de § TEMAS-ROLES-DECLARADOS-POR-EL-
 * PRESET-1, reemplazado entero — son composición, no contenido), `cromo` (§ CROMO-NAV-FOOTER-
 * TEMATIZABLE-1, los 3 ejes de chrome de nav/footer, reemplazado entero por la misma razón —
 * composición, no contenido, y META APARTE de `tema` a propósito, ver el docstring de
 * `CromoContent`), `volverArriba` (§ CROMO-VOLVER-ARRIBA-1, el botón flotante, reemplazado entero
 * por la misma razón — META PROPIA, aparte de `cromo`, ver el docstring de `VolverArribaContent`),
 * `rielSocial` (§ CROMO-RIEL-SOCIAL-1, el riel social, reemplazado entero por la misma razón — META
 * PROPIA, aparte de `cromo` y de `volverArriba`, ver el docstring de `RielSocialContent`),
 * `navTratamiento` (§ CROMO-NAV-TRATAMIENTO-1, el tratamiento tipográfico de los links del nav,
 * reemplazado entero por la misma razón — META PROPIA, aparte de `cromo`/`volverArriba`/
 * `rielSocial`, ver el docstring de `NavTratamientoContent`),
 * `navWordmark` (§ CORTE-LOGO-APILADO-1, el tratamiento tipográfico del wordmark apilado del nav,
 * reemplazado entero por la misma razón — META PROPIA, aparte de `cromo`/`volverArriba`/
 * `rielSocial`/`navTratamiento`, ver el docstring de `NavWordmarkContent`),
 * `esquemas`, `orden` y `variantesBandas` (reemplazados enteros, por la misma
 * razón), el campo `variante` DENTRO de cada sección afectada — preservando cualquier otro campo
 * que esa sección ya tuviera (`{ ...prev, variante }`) — y, SÓLO cuando la variante resultante de
 * `featured` es 'spotlight' (§ SPOTLIGHT-CABLEADO-HOME-1), el campo `visible` DENTRO de
 * `content.spotlight` (mismo `{ ...prev, visible: true }`, MISMA razón: es composición —qué banda
 * se ve, no qué dice—, no contenido del dueño). Ninguna otra clave de `content` se toca.
 *
 * `preset.variantes` mezcla DOS destinos bajo una sola clave plana (TEMAS-P1-FEATURED-VARIANTES-1):
 * una entrada cuya clave ES una `SeccionKey` (tiene entrada en el REGISTRY) va DENTRO de esa sección
 * (`content[seccion].variante`, como siempre); una entrada cuya clave es una banda ESTRUCTURAL sin
 * sección (`featured`) va al mapa `variantesBandas` (gemelo de `esquemas`), NUNCA a
 * `content[seccion]` directo — escribir ahí crearía una clave huérfana (`content.featured`) que
 * ningún loader ni componente lee.
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
    // AUSENTE en el preset → null (el default, byte-idéntico) — el mismo `?? null` que ya hace
    // falta para escribir un `TemaContent` completo (§ TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1).
    origenTexto: preset.origenTexto ?? null,
    origenAccion: preset.origenAccion ?? null,
    // AUSENTE en el preset → null (el default, byte-idéntico) — § TEMAS-ESCALA-DISPLAY-1.
    escalaDisplay: preset.escalaDisplay ?? null,
  };
  // `cromo` (§ CROMO-NAV-FOOTER-TEMATIZABLE-1): meta APARTE de `tema` — ver el docstring de
  // `CromoContent` para el porqué (el guardar/publicar de la paleta reemplaza `tema` entero y
  // resetearía estos 3 ejes en silencio si vivieran ahí).
  out.cromo = {
    navTinta: preset.navTinta ?? false,
    navSubtitulo: preset.navSubtitulo ?? false,
    navBadge: preset.navBadge ?? '',
  };
  // `volverArriba` (§ CROMO-VOLVER-ARRIBA-1): meta PROPIA, aparte de `cromo` — ver el docstring de
  // `VolverArribaContent` para el porqué (no comparte el contrato exhaustivo de 3 claves de `cromo`,
  // afirmado por `cromo-tematizable.test.ts`).
  out.volverArriba = {
    visible: preset.volverArribaVisible ?? false,
  };
  // `rielSocial` (§ CROMO-RIEL-SOCIAL-1): meta PROPIA, aparte de `cromo` Y de `volverArriba` — ver
  // el docstring de `RielSocialContent` para el porqué (MISMA razón que `volverArriba`: no comparte
  // el contrato exhaustivo de 3 claves de `cromo`, afirmado por `cromo-tematizable.test.ts`; y no se
  // fusiona con `volverArriba` porque ese dominio ya cerró SU propio contrato de 1 clave).
  out.rielSocial = {
    visible: preset.rielSocialVisible ?? false,
  };
  // `navTratamiento` (§ CROMO-NAV-TRATAMIENTO-1): meta PROPIA, aparte de `cromo`, `volverArriba` Y
  // `rielSocial` — ver el docstring de `NavTratamientoContent` para el porqué (conceptualmente es la
  // misma familia que `navTinta`/`navSubtitulo`/`navBadge`, pero no puede compartir el contrato
  // exhaustivo de 3 claves de `cromo`, afirmado por `cromo-tematizable.test.ts`, FUERA de `touches:`
  // de este slice).
  out.navTratamiento = {
    activo: preset.navTratamientoActivo ?? false,
  };
  // `navWordmark` (§ CORTE-LOGO-APILADO-1): meta PROPIA, aparte de `cromo`, `volverArriba`,
  // `rielSocial` Y `navTratamiento` — ver el docstring de `NavWordmarkContent` para el porqué (no es
  // el mismo eje que `navTratamiento`: aquél trata los links del nav, éste el wordmark apilado).
  out.navWordmark = {
    activo: preset.navWordmarkActivo ?? false,
  };
  out.esquemas = { ...preset.esquemas };
  out.orden = [...preset.orden];

  const registro = REGISTRY as Record<string, SeccionDef | undefined>;
  const variantesBandas: Record<string, string> = {};
  for (const [seccion, variante] of Object.entries(preset.variantes)) {
    if (registro[seccion]) {
      const prev = esObj(out[seccion]) ? out[seccion] : {};
      out[seccion] = { ...prev, variante };
    } else {
      variantesBandas[seccion] = variante;
    }
  }
  out.variantesBandas = variantesBandas;

  // SPOTLIGHT COMO VARIANTE DE `featured` (§ SPOTLIGHT-CABLEADO-HOME-1): `Spotlight.tsx` (NO
  // reescrito por este slice) revisa `seccionEsVisible(REGISTRY.spotlight, spotlight)` ANTES de
  // pintar un solo nodo — el mismo gate que protege a `DEFAULTS.spotlight` de encenderse SOLA
  // (§ site-content-defaults.ts, "nace OFF"; ese default sigue en `false`, sin tocar, porque el
  // motivo mecánico que lo justifica —`spotlight` fuera de `BANDA_IDS`— sigue vigente). Pero un
  // preset que ELIGE la variante 'spotlight' para `featured` está pidiendo, por definición, que esa
  // banda se VEA: sin esto, CORTE aplicaría la variante y `Spotlight` devolvería `null`
  // (`spotlight.visible` seguiría en su default `false`), dejando el slot de `featured` vacío — la
  // variante "elegida" y "en blanco" a la vez. Se enciende SÓLO cuando la variante resultante es
  // 'spotlight' (nunca para 'cuadricula'/'grilla', ni para ningún otro preset), preservando
  // cualquier otro campo que la sección ya tuviera (`{ ...prev, visible: true }`, igual que el
  // `variante` de arriba) — así un tenant que ya haya editado `eyebrow`/`titulo`/el pin no los
  // pierde al aplicar el preset.
  if (variantesBandas.featured === 'spotlight' && registro.spotlight) {
    const prevSpotlight = esObj(out.spotlight) ? out.spotlight : {};
    out.spotlight = { ...prevSpotlight, visible: true };
  }

  // ORIGEN (§ ORIGEN-BANDA-1) — GEMELO del exception de spotlight de arriba, pero para una banda
  // PROPIA en `BANDA_IDS`, no una variante de `featured`. `origen` nace `visible:false`
  // (§ DEFAULTS.origen, site-content-defaults.ts) por la MISMA razón mecánica que spotlight nació
  // OFF mientras estuvo fuera de `BANDA_IDS`: estar en la lista no alcanza para mostrarse.
  //
  // LA SEÑAL NO PUEDE SER "está en `preset.orden`" — a diferencia de spotlight (cuya señal, la
  // VARIANTE elegida, es exclusiva del preset que la pide), `orden` es universal: `ORDEN_DEFAULT =
  // [...BANDA_IDS]` alimenta también a ARRANQUE/VITRINA/PATIO (los tres lo usan tal cual, § abajo),
  // así que CUALQUIER preset que use el default tendría 'origen' en su `orden` resuelto sin haberlo
  // pedido. La señal es el booleano DEDICADO `preset.bandaOrigenVisible` — AUSENTE en TODO preset
  // salvo CORTE, así que ARRANQUE/VITRINA/PATIO no tocan `content.origen` en absoluto.
  if (preset.bandaOrigenVisible && registro.origen) {
    const prevOrigen = esObj(out.origen) ? out.origen : {};
    out.origen = { ...prevOrigen, visible: true };
  }

  // MARQUESINA (§ MARQUESINA-BANDA-1) — GEMELO EXACTO del bloque de `origen` de arriba, misma razón
  // mecánica: `marquesina` nace `visible:false` y `orden` es universal (`ORDEN_DEFAULT =
  // [...BANDA_IDS]` alimenta también a ARRANQUE/VITRINA/PATIO), así que la señal es el booleano
  // DEDICADO `preset.bandaMarquesinaVisible`, ausente en todo preset salvo CORTE.
  if (preset.bandaMarquesinaVisible && registro.marquesina) {
    const prevMarquesina = esObj(out.marquesina) ? out.marquesina : {};
    out.marquesina = { ...prevMarquesina, visible: true };
  }

  // HERO TOGGLES (§ TEMAS-HERO-TOGGLES-PRESET-1) — GEMELO de la escritura de `variante` en el loop
  // de `preset.variantes` de arriba, no de los bloques de banda de arriba: `hero` YA es una sección
  // del REGISTRY (siempre se muestra), así que acá no hay nada que "encender" — sólo dos booleanos
  // DENTRO de la sección que se escriben SÓLO si el preset los declara explícitamente, preservando
  // el resto de `content.hero` (`variante` incluida, si el mismo preset la pidió arriba) con
  // `{ ...prevHero, … }`. AUSENTE en el preset → no se toca ninguna de las dos claves, y el resolver
  // aplica su propio default (`true`/`false`) — el mismo mecanismo que ya deja `fraseAlPie` (CONTENIDO,
  // nunca escrita por un preset) intacta.
  if ((typeof preset.heroCtasVisibles === 'boolean' || typeof preset.heroCueDesliza === 'boolean') && registro.hero) {
    const prevHero = esObj(out.hero) ? out.hero : {};
    out.hero = {
      ...prevHero,
      ...(typeof preset.heroCtasVisibles === 'boolean' ? { ctasVisibles: preset.heroCtasVisibles } : {}),
      ...(typeof preset.heroCueDesliza === 'boolean' ? { cueDesliza: preset.heroCueDesliza } : {}),
    };
  }

  return out;
}

// ── Los cinco themes del diseño, tal como se declararon ──────────────────────────────────────────
// Los datos van embebidos acá porque el diseño vive fuera de este repo. Cada uno registra la
// intención COMPLETA de la entrega (las 5 columnas de variante: hero · featured · brandStory ·
// presentaciones · subscriptionCTA), aun sabiendo que ninguno de los cinco aplica completo hoy:
// `subscriptionCTA` sigue sin slot; `hero`/`brandStory`/`presentaciones`/`featured` SÍ tienen uno,
// pero de las composiciones que el diseño pide sólo la canónica de cada uno existe construida (§ el
// comentario de cabecera) — `validarPreset` los nombra, no se omiten en silencio.

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
  // MEDIDO contra el prototipo versionado (`docs/prototipos/cafeone/`), no inventado — reescritura
  // de CORTE-REESCRITURA-PROTOTIPO-1 (DECISIONS.md). Los valores viejos (`#efece6`/`#0c0b0a`/`#a3643a`,
  // `moderno`, `minima`) no salían de ninguna medición; el estándar del owner es que abrir el mirador
  // se vea como el prototipo, y eso exige leer sus TOKENS SEMÁNTICOS (qué ROL cumple cada color), no
  // su rampa. El preset guarda ROLES (fondo/tinta/acento), así que se mapea rol→rol:
  //   fondo  = --surface-page  (docs/prototipos/cafeone/ds/colors.css:39) — el body del prototipo
  //            (`background:var(--surface-page)`, css/app.css:43) pinta exactamente este color.
  //   tinta  = --text-heading  (colors.css:48) — el color de TODO titular (h1..h6, css/app.css:93-113)
  //            y coincide con `--surface-inverse` (colors.css:43), el verde-café oscuro de los paneles
  //            a sangre completa; es el mismo rol que nuestra `tinta` cumple como fondo oscuro (hero).
  //   acento = --action-primary (colors.css:59) — el color de TODO CTA primario
  //            (`.btn--primary{background:var(--action-primary)}`, css/app.css:73,134).
  raices: { fondo: '#fdfbf7', tinta: '#102407', acento: '#a70004' },
  // 'prensa' (Roboto Serif / Figtree) — el par que TEMAS-PAR-PRENSA-1 (DECISIONS.md, 2026-09-15) sumó
  // al catálogo declarando EXPLÍCITAMENTE «es prerrequisito de CORTE», y hasta este slice CORTE no lo
  // usaba (traía 'moderno', Sora/Inter). El TITULAR calza EXACTO: `--font-serif`/`--font-heading` del
  // prototipo (docs/prototipos/cafeone/ds/typography.css:2,5) es 'Roboto Serif', igual que `titulo` de
  // 'prensa' (fuentes.ts). El CUERPO NO calza exacto: el prototipo usa 'Hanken Grotesk'
  // (typography.css:3,6) y 'prensa' trae 'Figtree' — el catálogo es CERRADO (no se agrega una entrada
  // nueva para este slice) y 'prensa' es, medido contra los diez pares, el que más se acerca (el único
  // con el titular EXACTO). Reportado, no disimulado.
  fuentePar: 'prensa',
  // 'recta' (radios 0/0/0) — el prototipo lo declara en su propia cabecera de CSS: «Buttons and
  // interface chrome are SQUARE (--radius-button:0). Nunca se redondea un botón»
  // (docs/prototipos/cafeone/css/app.css:8; el mismo valor en radius.css:11 `--radius-button:0px` y
  // :12 `--radius-card:0px`). Los TRES tokens que nuestro sistema efectivamente LEE hoy
  // (`--radius-3xl/2xl/xl`, que en el storefront gobiernan botones/tarjetas/inputs — grep de
  // `rounded-2xl`/`rounded-xl` en app/(storefront) y components/storefront, no sólo imágenes) son
  // 0/0/0 en 'recta' (formas.ts), el único match exacto del set cerrado. 'minima' (el valor viejo,
  // 6-10px) contradice la regla explícita del prototipo. Las imágenes SÍ se redondean en el prototipo
  // (`--radius-image:16px`/`--radius-tile:20px`), pero ese rol lo cubre `--sf-radio-lg` — hoy INERTE
  // en nuestro sistema (§ formas.ts, "LO QUE ESTA MITAD CONECTA vs LO QUE QUEDA INERTE"), así que no
  // hay valor propio del set cerrado que lo represente todavía.
  forma: 'recta',
  // `brandStory: 'centrada'` (§ CORTE-BRANDSTORY-COLLAGE-1) — hasta ese slice CORTE pedía la
  // canónica ('columnas') porque era la ÚNICA clave que `brandStory.variantes` declaraba; el estándar
  // del owner es que el mirador se vea como el prototipo, y su sección `.historia` es la composición
  // CENTRADA (eyebrow+título al medio, collage a lo ancho, párrafo debajo — no la de dos columnas).
  // Con la clave ya construida (`REGISTRY.brandStory.variantes.claves`, site-content-defaults.ts),
  // ese fue el único punto del catálogo de presets que ese slice tocó.
  //
  // `presentaciones: 'riel'` (§ CORTE-PRESENTACIONES-RIEL-1) — hasta este slice CORTE pedía la
  // canónica ('mosaico'), la única clave real cuando se reescribió el preset. La sección
  // `.presentaciones` del prototipo (`index.html:225-247`) es un RIEL horizontal con controles, no el
  // grid de tarjetas de la canónica; con la clave ya construida
  // (`REGISTRY.presentaciones.variantes.claves`, site-content-defaults.ts), este es el único punto del
  // catálogo de presets que este slice toca.
  //
  // `featured: 'spotlight'` (§ SPOTLIGHT-CABLEADO-HOME-1) — hasta este slice CORTE pedía 'grilla'
  // (una malla de 6 productos, TEMAS-FEATURED-GRILLA-1). MEDIDO contra el prototipo
  // (`docs/prototipos/cafeone/index.html:159-217`, id="producto", aria-labelledby="spot-h"): la
  // sección "Producto insignia" es un ÚNICO producto con badge de cosecha, selector de
  // molienda/tamaño, notas de cata y "Agregar al carrito" — exactamente lo que
  // `components/storefront/home/Spotlight.tsx` construye (§ SPOTLIGHT-BANDA-1), no la malla de 6
  // que 'grilla' pintaba ahí. 'grilla' era la mejor variante DISPONIBLE en su momento (SPOTLIGHT-
  // BANDA-1 todavía no existía); con la variante real construida, CORTE se re-mide contra ella.
  variantes: {
    hero: 'media',
    featured: 'spotlight',
    brandStory: 'centrada',
    presentaciones: 'riel',
    subscriptionCTA: 'linea',
  },
  // `esquemas` (§ CORTE-ESQUEMAS-INVERTIDOS-1, DECISIONS.md) — REESCRITO banda por banda contra el
  // prototipo; no es un ajuste del mapa anterior. EL DEFECTO: `CORTE-REESCRITURA-PROTOTIPO-1` cambió
  // las tres raíces (§ arriba) y no volvió a decidir ESTE eje — las tres asignaciones 'oscuro' de
  // antes (pensadas contra otra paleta, donde daban "casi negro sobre neutro cálido") pasaron a
  // pintar trustBadges/featured/brandStory con la RAÍZ TINTA (#102407) como lienzo COMPLETO. El
  // prototipo no hace eso: su body es `--surface-page` (docs/prototipos/cafeone/css/tokens.css:57,
  // #fdfbf7) y `--surface-inverse` (tokens.css:61, #102407) sólo pinta CHROME —header en su estado
  // sólido, mega-menú, cajón del carrito, pie de página, toast (grep de `surface-inverse` en
  // css/app.css: 188-329, 633-674, 836)—, NUNCA una banda de contenido del home. Owner (2026-09-19):
  // «el verde profundo es TINTA y superficies de acento PUNTUALES (nav, footer), no el canvas».
  //   trustBadges → sin análogo directo en el prototipo (no hay franja de insignias); sin evidencia
  //     de lienzo oscuro para esta banda, se deja en la página — 'crema'.
  //   featured·spotlight → `.spotlight` (index.html:160, "Nuestro café") — el nombre de clase del
  //     prototipo es LITERALMENTE "spotlight", el mismo que la variante que hoy vive ahí (§
  //     SPOTLIGHT-CABLEADO-HOME-1; esta asignación de esquema se escribió cuando 'grilla' ocupaba el
  //     slot y no cambia con la variante — el esquema es del BANDA_ID `featured`, no de su
  //     composición) — `background:var(--surface-page)` (css/app.css:436) — 'crema'.
  //   brandStory·centrada → `.historia` (index.html:250), `background:var(--surface-page-cool)`
  //     (css/app.css:564) — una superficie APENAS distinta de la página, ni la página exacta ni la
  //     tinta — 'superficie' (deriva a #f3eadb con las raíces de CORTE, medido con `derivarEsquema`;
  //     el prototipo da #f0f0ec — misma FAMILIA de "superficie apenas distinta", no puede calzar
  //     exacto sin tocar las raíces, fuera de `touches` de este slice).
  //   presentaciones·riel → `#presentaciones` es `class="section"` SIN override de fondo
  //     (index.html:226); el body ya es `--surface-page` (css/app.css:43) — 'crema' (antes
  //     'superficie', que la distinguía de la página sin que el prototipo lo pida; sólo
  //     `.pres-media`, la miniatura de CADA tarjeta —no la banda—, usa `--surface-tile`,
  //     tokens.css:60, y ese token no lo gobierna este eje: `GrindChooserRiel.tsx` pinta esa
  //     miniatura con `--sf-linea`, no con `--sf-tarjeta`).
  //   subscriptionCTA·linea → SIN CAMBIO, 'crema'. El análogo más cercano del prototipo es
  //     `.cta-strip` ("Únete al club", index.html:313), pero es una FOTO con `--protect-grad`
  //     (css/app.css:620 — un degradado teñido de tinta SOBRE una imagen, tokens.css:217), no un
  //     lienzo sólido; el newsletter real vive DENTRO del pie (index.html:323-331,
  //     `--surface-inverse`). Se consideró 'oscuro' por la POSICIÓN (última banda antes de
  //     testimonials/pie, igual que el cta-strip antes del pie) y se descartó: es evidencia de
  //     posición, no un lienzo sólido medido, y el estándar del owner es tinta PUNTUAL (nav, footer)
  //     — se prefiere la lectura conservadora. Queda como duda abierta, no una decisión ciega.
  //   origen (§ ORIGEN-BANDA-1) → `#origen` es `class="section"` SIN override de fondo
  //     (index.html:276), MISMO caso que `presentaciones·riel` arriba (el body ya es
  //     `--surface-page`) — 'crema'.
  esquemas: {
    trustBadges: 'crema',
    featured: 'crema',
    brandStory: 'superficie',
    origen: 'crema',
    presentaciones: 'crema',
    subscriptionCTA: 'crema',
  },
  // «usa el default de hoy, sin reordenar» (§2) — el mismo ORDEN_DEFAULT que ya usa Nayoli.
  // `origen` (§ ORIGEN-BANDA-1) hereda su POSICIÓN de este spread (queda tras `brandStory`, § el
  // orden de `BANDA_IDS`) SIN necesidad de escribir un array explícito acá — su VISIBILIDAD es un
  // eje aparte, `bandaOrigenVisible` (abajo), porque `ORDEN_DEFAULT` también alimenta a
  // ARRANQUE/VITRINA/PATIO y "estar en el orden" no puede ser la señal de "se muestra" (§ el
  // comentario de `mergePresetEnContent` sobre esta misma distinción).
  orden: ORDEN_DEFAULT,
  // origenTexto/origenAccion (§ TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1, DECISIONS.md) — el defecto
  // que el owner reportó gateando este mirador contra el prototipo, y que `CORTE-ESQUEMAS-
  // INVERTIDOS-1` dejó explícitamente sin tocar: `--action-primary` de CORTE (`raices.acento`,
  // #a70004) es COLOR DE ACCIÓN puro —no un tono cálido de lectura—, y el motor de paleta
  // (`palette-derive.ts`) hacía nacer del acento TANTO el texto de lectura (rojizo) COMO el fondo
  // de la acción primaria (`tostado`, un mix acento/fondo que con un acento rojo sale beige/rosado,
  // no rojo). CORTE es el ÚNICO de los seis presets que declara los dos ejes — los otros cinco (y
  // todo tenant real) quedan exactamente como estaban, byte a byte (§ el test de
  // `palette-derive.test.ts` que lo afirma).
  origenTexto: 'tinta',   // texto/texto-suave/acento-texto nacen de la TINTA — el `--text-heading`
                          // del prototipo (`docs/prototipos/cafeone/ds/colors.css:48`) ES la tinta.
  origenAccion: 'acento', // el fondo de la acción primaria (hoy `tostado`) nace del ACENTO crudo —
                          // el `--action-primary` real del prototipo (`colors.css:59`).
  // navTinta/navSubtitulo/navBadge (§ CROMO-NAV-FOOTER-TEMATIZABLE-1, `navTinta` RESEMANTIZADO en
  // CORTE-NAV-TRANSPARENTE-HERO-1) — MEDIDOS contra el prototipo, no inventados. El `.site-header`
  // (`css/app.css:172-191`) flota TRANSPARENTE sobre el hero (`background:transparent`) y sólo pinta
  // `--surface-inverse` (el MISMO verde-tinta que ya es `raices.tinta` de CORTE) AL SCROLLEAR
  // (`.is-solid`) — nunca sólida siempre. La lectura anterior de este comentario ("se declara SÓLIDA
  // SIEMPRE, la simplificación pedida por el spec de este slice") medía mal el prototipo: leyó
  // `--surface-inverse` en el estado sólido y asumió que era el ÚNICO estado, sin notar el
  // `background:transparent` de la regla base. `navTinta:true` hoy declara sólo el COLOR del estado
  // sólido (tinta, no la tarjeta clara de los otros temas); el floating lo decide `tratamientoNav`
  // igual que para cualquier tema — CORTE lo hereda porque su hero (`variantes.hero:'media'`, abajo)
  // es oscuro y uniforme, sin esquema asignado a 'hero'. El wordmark trae su sub-encabezado
  // (`.wordmark small`, `index.html:23`, "San Adolfo · Huila") y el primer `nav-item` su badge de
  // cosecha (`.badge`, `index.html:32`, "Cosecha 2026") — `navBadge` lleva ese texto EXACTO como el
  // valor de MUESTRARIO de este preset (§ el docstring de `CromoContent.navBadge`: es dato del
  // tenant, no un año horneado en el componente).
  navTinta: true,
  navSubtitulo: true,
  navBadge: 'Cosecha 2026',
  // escalaDisplay (§ TEMAS-ESCALA-DISPLAY-1) — el owner: «los titulares del prototipo son
  // ENORMES; medí sus tamaños reales y llevalos al preset». Medido contra `docs/prototipos/
  // cafeone/ds/typography.css:10-11`: `--text-display-xl:clamp(72px,9vw,168px)` (el titular del
  // hero) y `--text-display-l:clamp(48px,5vw,76px)` (los CINCO `h2.display-l` de sección:
  // `spot-h`/`pres-h`/`hist-h`/`orig-h`, `index.html:166,231,253,288` — el prototipo usa LA MISMA
  // clave para las cinco, así que CORTE hace lo mismo con sus propias bandas: featured,
  // brandStory, presentaciones, subscriptionCTA, testimonials. `origen` (§ ORIGEN-BANDA-1) es la
  // SEXTA que lee este eje —`Origen.tsx` llama `fontSizeDisplay(tema.escalaDisplay,'l')`, mismo
  // mecanismo, corresponde a `orig-h` del prototipo—, sumada tras la construcción de la banda; esta
  // lista de nombres describía 5 consumidores cuando `origen` todavía no existía). CORTE es el
  // ÚNICO de los seis presets que lo declara — los otros cinco quedan exactamente como estaban,
  // byte a byte (§ el test de `escala-display.test.ts` que afirma `null` → sin override).
  escalaDisplay: 'amplia',
  // bandaOrigenVisible (§ ORIGEN-BANDA-1) — ver el docstring del campo en `PresetTema`, arriba.
  // CORTE es hoy el ÚNICO preset que la declara; los otros cinco no tocan `content.origen`.
  bandaOrigenVisible: true,
  // bandaMarquesinaVisible (§ MARQUESINA-BANDA-1) — GEMELO de `bandaOrigenVisible`, arriba. La
  // marquesina hereda su POSICIÓN 2ª (justo tras `hero`) del `orden: ORDEN_DEFAULT` de abajo, SIN
  // necesidad de un array explícito acá — mismo mecanismo que ya usa `origen` para su posición.
  // NINGÚN esquema propio en `esquemas` (abajo): su fondo lo da su propia canónica OSCURA
  // (`BANDAS_OSCURAS`, `bg-[var(--sf-banda,var(--sf-tinta))]`), igual que `hero` —el prototipo pinta
  // `.marquee{background:var(--green-900)}` bajo la foto velada, la MISMA raíz `tinta` que ya
  // gobierna esa canónica—, así que asignarle un esquema sería una segunda fuente de verdad
  // discrepando con la que ya la pinta bien.
  bandaMarquesinaVisible: true,
  // heroCtasVisibles/heroCueDesliza (§ TEMAS-HERO-TOGGLES-PRESET-1) — MEDIDO contra el prototipo
  // (`docs/prototipos/cafeone/index.html:122-138`): `.hero-media` no lleva ningún `.btn` (a
  // diferencia de `.hero-media .hero-inner`, que sólo trae el eyebrow/título/párrafo/caption) y SÍ
  // trae `.scroll-cue` con la etiqueta "Desliza" (`index.html:135-137`). `TEMAS-HERO-MEDIA-
  // AGREGADOS-1` construyó los dos campos como booleanos de CONTENIDO (default = el hero de HOY,
  // dos CTA visibles y sin cue) pero ese slice no tocó `themes.ts`, así que CORTE los heredaba en su
  // default — el mirador mostraba botones que el prototipo no tiene y ningún cue. CORTE es hoy el
  // ÚNICO preset que declara los dos; los otros cinco no tocan `content.hero.ctasVisibles`/
  // `cueDesliza` (§ el test de `hero-toggles-preset.test.ts` que lo afirma).
  heroCtasVisibles: false,
  heroCueDesliza: true,
  // volverArribaVisible (§ CROMO-VOLVER-ARRIBA-1) — MEDIDO contra el prototipo: `.to-top`
  // (`docs/prototipos/cafeone/index.html:116`, `css/app.css:340-353`) es una pastilla fija
  // abajo-derecha que pinta `background:var(--action-primary)` — el MISMO rol que ya mapea
  // `raices.acento` de CORTE (§ el comentario de `raices`, arriba) — y aparece tras
  // `window.scrollY > window.innerHeight` (`js/app.js:361`), ocultándose con
  // `body.drawer-open` (`css/app.css:352`, el carrito abierto). CORTE es hoy el ÚNICO preset del
  // catálogo que lo declara; los otros cinco no tocan `content.volverArriba`.
  volverArribaVisible: true,
  // rielSocialVisible (§ CROMO-RIEL-SOCIAL-1) — MEDIDO contra el prototipo: `.rail`
  // (`docs/prototipos/cafeone/index.html:109`, `css/app.css:326-338`) es un nav vertical fijo a la
  // izquierda con `background:var(--surface-inverse)` — la superficie-inversa del tema, `--sf-tinta`
  // acá — visible sólo `@media (min-width:1560px)` (`css/app.css:339`). CORTE es hoy el ÚNICO preset
  // del catálogo que lo declara; los otros cinco no tocan `content.rielSocial`.
  rielSocialVisible: true,
  // navTratamientoActivo (§ CROMO-NAV-TRATAMIENTO-1) — MEDIDO contra el prototipo: `.nav-link`
  // (`docs/prototipos/cafeone/css/app.css:212-217`) declara `font-family:var(--font-ui)` (=
  // `--font-sans`, LA SANS del par — NO una tercera familia; `--font-ui` mide igual a `--font-body`,
  // `tokens.css:95-96`), `text-transform:uppercase`, `letter-spacing:var(--tracking-nav)` (=
  // `.06em`, `tokens.css:129`) y `font-size:var(--text-body-s)` (ya cubierto por el `text-sm` de
  // HOY, sin cambio). El PESO: `.nav-link` NO declara `font-weight` propio —ni `.site-header` ni
  // `.header-bar`, sus ancestros, lo hacen tampoco (`app.css:173-210`)— así que hereda el del
  // `body` (`app.css:21-28`), que TAMPOCO lo declara → el default del navegador, `400`/regular. Por
  // eso el tratamiento reemplaza el `font-medium` (500) de HOY por `font-normal` (400), no lo
  // conserva. CORTE es hoy el ÚNICO preset del catálogo que lo declara; los otros cinco no tocan
  // `content.navTratamiento`.
  navTratamientoActivo: true,
  // navWordmarkActivo (§ CORTE-LOGO-APILADO-1) — MEDIDO contra el prototipo: `.wordmark`
  // (`docs/prototipos/cafeone/css/app.css:199-205`) declara `font-family:var(--font-display)` (la
  // MISMA serif del par — sin cambio), `font-size:30px`, `letter-spacing:.01em`,
  // `text-transform:uppercase`; `.wordmark small` (`app.css:206-207`) declara
  // `font-family:var(--font-ui)` (la sans del par — `font-inter` acá, NO `font-display`),
  // `font-size:11px` (ya cubierto por el `text-[11px]` de HOY, sin cambio),
  // `letter-spacing:var(--tracking-eyebrow)` (= `.11em`, `tokens.css:127`), `color:var(--text-on-
  // inverse-muted)`, `margin-top:4px`, `font-weight:var(--weight-regular)` (400) — SIN itálica. El
  // apilado (nombre+sub) YA EXISTE (rama `subtitle` de `Logo.tsx`, encendida por `navSubtitulo`
  // arriba, § CROMO-NAV-FOOTER-TEMATIZABLE-1); este eje sólo cambia el ESTILO de esa rama. CORTE es
  // hoy el ÚNICO preset del catálogo que lo declara; los otros cinco no tocan `content.navWordmark`.
  navWordmarkActivo: true,
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
 * ya soporta — `hero·ficha` y `presentaciones·indice`, dos variantes no-canónicas YA CONSTRUIDAS
 * (NO las únicas que existen hoy fuera de sus canónicas — ese conteo cambia con cada slice que suma
 * una composición; grep `REGISTRY.<seccion>.variantes.claves` para el set vigente. Esta frase decía
 * "las dos únicas" y quedó vencida sin que nadie la tocara — § `THEMES-COMENTARIO-ARRANQUE-
 * VARIANTES-VENCIDO-1`, corregido en `CORTE-COMENTARIOS-VENCIDOS-1`), `brandStory` intacta (SÍ
 * tiene slot —canónica `columnas`, TEMAS-P2-BRANDSTORY-1— pero ARRANQUE no le pide nada: no
 * mencionarla deja lo que ya hubiera, y
 * Nayoli ya está en su canónica), un par de esquemas reales, y el par/forma explícitos
 * (`editorial`/`suave`, la propia canónica de Nayoli).
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
    // brandStory: sin entrada a propósito — SÍ tiene slot (canónica `columnas`), pero no hace falta
    // pedirlo: Nayoli ya está en su canónica, y `mergePresetEnContent` no toca lo que no se menciona.
  },
  esquemas: {
    featured: 'crema',
    subscriptionCTA: 'acento',
  },
  orden: ORDEN_DEFAULT,
};

/** El catálogo completo — los cinco themes del diseño + el de arranque. */
export const PRESETS: readonly PresetTema[] = [PLIEGO, CORTE, PATIO, VETA, VITRINA, ARRANQUE];
