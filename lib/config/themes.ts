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
  type SeccionDef, type BandaId, type ClaveEsquema, type MenuItemId, type ClaveDrawerMovil,
  type ClaveCarrito,
} from './site-content-defaults';
import { RAICES_DEFECTO, type OrigenTexto, type OrigenAccion } from './palette-derive';
import type { ClaveEscalaDisplay } from './escala-display';

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// LEE un valor por RUTA PUNTEADA ("tema.fondo", "hero.variante", "esquemas" para un campo de primer
// nivel) de un `content` crudo o resuelto — SOFT, nunca lanza: ausente en cualquier tramo → `undefined`,
// igual que el resto de los loaders de este archivo. La usa `mergePresetEnContent` (§ REAPPLY-
// PRESERVA-OVERRIDES-1) para leer el valor ACTUAL de un campo antes de decidir si el dueño lo tocó.
function leerRuta(obj: Record<string, unknown>, ruta: string): unknown {
  let cur: unknown = obj;
  for (const parte of ruta.split('.')) {
    if (!esObj(cur)) return undefined;
    cur = cur[parte];
  }
  return cur;
}

// IGUALDAD ESTRUCTURAL (no por referencia): arrays por posición, objetos por sus claves,
// recursivamente. Los valores que la fusión de tres vías compara son siempre JSON simple (string/
// boolean/null/array de string/objeto plano de un nivel) — no hace falta un deep-equal genérico para
// cualquier dato del repo, sólo para éstos.
function igualValor(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => igualValor(v, b[i]));
  }
  if (esObj(a) && esObj(b)) {
    const clavesA = Object.keys(a);
    const clavesB = Object.keys(b);
    return clavesA.length === clavesB.length && clavesA.every((k) => igualValor(a[k], b[k]));
  }
  return false;
}

// Duplicado LITERAL, y a propósito documentado: el set de 5 esquemas (§ CORTE-HISTORIA-COLOR-
// FOTOS-1, `neutro`) ya vive como `ESQUEMA_IDS` en `site-content-defaults.ts`, pero esa constante
// NO está exportada. Se acepta esta única lista corta, gemela del tipo `ClaveEsquema` (=
// `EsquemaId` de `palette-derive.ts`), como la excepción que confirma la regla «derivada, no una
// segunda lista» — el día que se toque ese archivo por otra razón que exija exportarla, esta lista
// se reemplaza por el import.
const ESQUEMAS_VALIDOS: readonly ClaveEsquema[] = ['crema', 'superficie', 'oscuro', 'acento', 'neutro'];

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
 * `bandasVisibles` (§ MUESTRARIO-BANDA-APAGABLE-1, OPCIONAL) — la capacidad GENERAL de declarar qué
 * bandas tiene el diseño de un preset, encendiendo Y apagando, sobre CUALQUIER `BandaId` —no sólo
 * las dos que nacen `visible:false` (`origen`/`marquesina`, antes cada una con su propio booleano
 * dedicado: `bandaOrigenVisible`/`bandaMarquesinaVisible`, RETIRADOS por este slice y reemplazados
 * por entradas de este mapa). AUSENTE en un preset, o una banda ausente del mapa, = el comportamiento
 * de HOY, byte a byte: `mergePresetEnContent` no toca el `visible` de esa sección, y el resolver
 * aplica su propio default (`false` para `origen`/`marquesina`, `true` para el resto —
 * `DEFAULTS.<banda>.visible`, `site-content-defaults.ts`). `mergePresetEnContent` NUNCA escribe
 * texto/imagen de la sección —sólo este booleano—, exactamente como ya hace con `spotlight.visible`
 * cuando `featured` elige esa variante: encender/apagar la banda sin poder tocar su copy es lo que
 * hace que el mirador de un preset la muestre (u oculte) con el contenido que YA hubiera en esa
 * sección (los DEFAULTS, para un tenant sin fila propia como Nayoli).
 *
 * La señal NO PUEDE ser "está en `preset.orden`" (misma razón que ya regía a los dos booleanos
 * viejos): `orden` es universal —`ORDEN_DEFAULT = [...BANDA_IDS]` alimenta también a ARRANQUE/
 * VITRINA/PATIO— así que estar en la lista no alcanza para mostrarse, ni ausente de la lista alcanza
 * para ocultarse (`resolverOrden` reinserta al final toda banda de `BANDA_IDS` que falte, sin tocar
 * su `visible`). La señal es SIEMPRE `bandasVisibles`, explícita por banda.
 *
 * `heroCtasVisibles`/`heroCueDesliza` (§ TEMAS-HERO-TOGGLES-PRESET-1, OPCIONALES) — NO CONFUNDIR con
 * `bandasVisibles` de arriba (ese ENCIENDE/APAGA una banda ENTERA de `BANDA_IDS`); estos dos son los
 * DOS BOOLEANOS que `REGISTRY.hero.booleanos` ya declara DENTRO de
 * la sección `hero` (`ctasVisibles`/`cueDesliza`, § TEMAS-HERO-MEDIA-AGREGADOS-1) — `hero` ya existe
 * y ya se muestra en TODO tenant; lo que faltaba era que un preset pudiera apagar sus CTA y encender
 * su cue "Desliza" sin depender de que el panel del cliente los toque. AUSENTE en un preset = el
 * comportamiento de HOY, byte a byte (`content.hero.ctasVisibles` sigue resolviendo a `true`,
 * `content.hero.cueDesliza` a `false` — los defaults que `resolverSiteContent` ya aplica). La FRASE
 * al pie (`hero.fraseAlPie`) NO tiene su gemelo acá a propósito: es CONTENIDO del tenant (un texto,
 * no una composición), así que ningún preset la siembra — mismo criterio que `mergePresetEnContent`
 * nunca escribe el `titulo`/`lede` de `origen` o el `texto` de `marquesina`.
 *
 * `heroTitularVisible`/`heroSubtituloVisible` (§ CORTE-HERO-TITULAR-OCULTABLE-1, OPCIONALES) —
 * ESPEJO EXACTO de `heroCtasVisibles`/`heroCueDesliza` arriba, mismo mecanismo, DOS booleanos MÁS
 * de `REGISTRY.hero.booleanos` (`titularVisible`/`subtituloVisible`, § TEMAS-HERO-MEDIA-AGREGADOS-1
 * ampliado). AUSENTE en un preset = el comportamiento de HOY, byte a byte
 * (`content.hero.titularVisible`/`subtituloVisible` siguen resolviendo a `true`). El `.hero-inner`
 * del prototipo (`docs/prototipos/cafeone/index.html:130-138`) no lleva eyebrow, titular ni
 * subtítulo — sólo el video de fondo, `.hero-caption` (`fraseAlPie`) y `.scroll-cue`
 * (`cueDesliza`) — así que CORTE apaga los dos.
 *
 * `heroAlturaLlena` (§ CORTE-HERO-VIEWPORT-LLENO-1, OPCIONAL) — UN booleano MÁS de
 * `REGISTRY.hero.booleanos` (`alturaLlena`, ver el docstring de `HeroContent.alturaLlena` en
 * `site-content-defaults.ts` para la unidad de viewport y por qué). AUSENTE en un preset = el
 * comportamiento de HOY, byte a byte (`content.hero.alturaLlena` sigue resolviendo a `false`,
 * `min-h-[92vh]`). El `.hero` del prototipo (`docs/prototipos/cafeone/css/app.css:358-362`) es
 * `height:calc(100vh - (var(--frame-gap) * 2))` con `min-height:640px` — ocupa el viewport
 * COMPLETO, no un 92% de él —, así que CORTE lo enciende.
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
 * `carritoEnvioVisible` (§ MUESTRARIO-CARRITO-BARRA-ENVIO-1, OPCIONAL) — ¿el pie del carrito rinde
 * la barra de progreso visual hacia el envío gratis (gemela de `.ship-prog`/`.ship-bar` del
 * prototipo, `docs/prototipos/cafeone/index.html:409-411`)? AUSENTE = el comportamiento de HOY,
 * byte a byte (el carrito muestra sólo la frase condicional de siempre, `CartDrawer.tsx`). Escribe
 * `content.carritoEnvio.visible` (`CarritoEnvioContent`, meta PROPIA — MISMA razón que
 * `volverArribaVisible`/`rielSocialVisible`: no comparte objeto ni con `cromo`, `volverArriba` ni
 * `rielSocial`). CORTE es hoy el ÚNICO preset que lo declara.
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
 *
 * `navDrawerMovilVariante` (§ MUESTRARIO-DRAWER-MOVIL-TEMA-1, OPCIONAL) — ¿el drawer móvil (el panel
 * que abre el botón hamburguesa en `<lg`) rinde la composición de PANTALLA COMPLETA del prototipo
 * (`.mobile-nav`, `docs/prototipos/cafeone/css/app.css:300-321`, `index.html:93-106` — cabecera
 * propia con wordmark+botón cerrar, links con entrada escalonada por `--i`)? AUSENTE = el
 * comportamiento de HOY, byte a byte (el panel angosto `motion.div`/`AnimatePresence` bajo el
 * header, sin cabecera propia ni escalonado). Escribe `content.navDrawerMovil.variante`
 * (`NavDrawerMovilContent`, meta PROPIA — ver su docstring en `site-content-defaults.ts` para el
 * porqué de que no comparta objeto con `cromo`/`volverArriba`/`rielSocial`/`navTratamiento`/
 * `navWordmark`: es una VARIANTE de FORMA, como `hero.variante`, no un ajuste ON/OFF sobre un
 * elemento que ya existe en su forma de hoy). CORTE es hoy el ÚNICO preset que lo declara.
 *
 * `carritoVariante` (§ MUESTRARIO-CARRITO-COMPOSICION-1, OPCIONAL) — ¿el cajón del carrito rinde la
 * composición FLOTANTE del muestrario (`.drawer`, `docs/prototipos/cafeone/css/app.css:708-717` —
 * separado de los tres bordes libres por un margen, esquinas redondeadas del lado que mira al borde
 * de pantalla, fondo de superficie de PÁGINA, cabecera en tamaño de titular y peso regular)?
 * AUSENTE = el comportamiento de HOY, byte a byte (el cajón pegado al borde derecho, fondo de
 * TARJETA, cabecera semibold sin tamaño declarado). Escribe `content.carrito.variante`
 * (`CarritoContent`, meta PROPIA — ver su docstring en `site-content-defaults.ts` para el porqué de
 * que no comparta objeto con `carritoEnvio`: es la barra de progreso de envío gratis, OTRO eje del
 * mismo carrito). CORTE es hoy el ÚNICO preset que lo declara.
 *
 * `menuBadgeItem`/`menuBadgeTexto` (§ CORTE-BADGE-COSECHA-EN-MENU-1, OPCIONALES) — el badge de
 * cosecha del prototipo (`.nav-item .badge`, `index.html:27-32`), MUDADO de `navBadge` (arriba, que
 * envolvía el LOGO) a ser un ATRIBUTO de UN ítem del menú (`MenuContent.badgeItem`/`.badgeTexto`,
 * `site-content-defaults.ts`). A diferencia de `navTinta`/`navSubtitulo`/`navBadge` (una META
 * aparte, `content.cromo`, reemplazada ENTERA), `menu` YA es una SECCIÓN de verdad (§ REGISTRY.menu)
 * — así que estos dos campos se ESCRIBEN DENTRO de `content.menu`, preservando labels/posiciones/CTA
 * que la sección ya tuviera, con el mismo mecanismo `{ ...prevMenu, … }` que `heroCtasVisibles`/
 * `heroCueDesliza` (arriba) ya usan para `content.hero`. AUSENTE en un preset = no se toca ninguna
 * de las dos claves (el resolver aplica su propio default, `''` = sin badge). CORTE es hoy el ÚNICO
 * preset que los declara; `navBadge` queda DORMIDO (declarado, sin lector en `StoreNav.tsx` desde
 * este slice) — candidato a retiro, no retirado acá (§ el porqué en `StoreNav.tsx`).
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
  bandasVisibles?: Readonly<Partial<Record<BandaId, boolean>>>;
  heroCtasVisibles?: boolean;
  heroCueDesliza?: boolean;
  heroTitularVisible?: boolean;
  heroSubtituloVisible?: boolean;
  heroAlturaLlena?: boolean;
  volverArribaVisible?: boolean;
  rielSocialVisible?: boolean;
  carritoEnvioVisible?: boolean;
  navTratamientoActivo?: boolean;
  navWordmarkActivo?: boolean;
  navDrawerMovilVariante?: ClaveDrawerMovil;
  carritoVariante?: ClaveCarrito;
  menuBadgeItem?: MenuItemId;
  menuBadgeTexto?: string;
}

/** Lo que le falta a un preset para poder aplicarse, por REGLA (§3 a-e) y por NOMBRE. */
export interface FaltanteTema {
  regla: 'fuentePar' | 'forma' | 'variante' | 'esquema' | 'orden' | 'bandaVisible';
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
 *  e) cada clave del mapa `bandasVisibles` existe en BANDA_IDS (§ MUESTRARIO-BANDA-APAGABLE-1,
 *     GEMELA de (b) para el dominio de visibilidad en vez de esquema).
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

  // (e) bandasVisibles — cada clave del mapa tiene que existir en BANDA_IDS, GEMELA de (b) para el
  // dominio de visibilidad. Atrapa un id corrupto/ajeno al tipo, igual que (b) atrapa un `banner` en
  // `esquemas`.
  for (const banda of Object.keys(preset.bandasVisibles ?? {})) {
    if (!bandaIds.includes(banda)) {
      faltantes.push({
        regla: 'bandaVisible',
        detalle: `${preset.clave} asigna visibilidad a \`${banda}\`, que no existe en BANDA_IDS`,
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
 * LA FUSIÓN DE TRES VÍAS (§ REAPPLY-PRESERVA-OVERRIDES-1). Antes de este slice, re-aplicar un preset
 * REEMPLAZABA sin condición cada campo que declaraba — correcto mientras el dueño no podía tocar
 * ninguno de esos campos desde el panel. El programa de 8 ítems (PANEL-EDITOR-*) volvió editables
 * casi todos: `hero.variante`, los interruptores de `cromo`/`hero`, el badge de `menu`… Sin cambiar
 * nada más, re-aplicar el MISMO preset (para recibir una mejora futura) le habría BORRADO al dueño
 * cualquier ajuste que hubiera hecho con esos controles.
 *
 * La salida es una fusión, por CAMPO, contra un SNAPSHOT de lo que ESTE motor escribió la última vez
 * (`content.presetSnapshot`, meta § site-content-defaults.ts, un mapa RUTA→valor-declarado):
 *  · SIN entrada en el snapshot para esa ruta (primer apply sobre el tenant, o una fila de antes de
 *    esta capacidad) → se escribe lo que el preset declara, BYTE A BYTE el comportamiento de hoy —
 *    sin base de comparación no hay forma honesta de decir "el dueño lo tocó".
 *  · CON entrada Y el valor ACTUAL de `content` en esa ruta COINCIDE con el snapshot → el dueño no lo
 *    tocó desde el último apply → se escribe lo que el preset declara AHORA (así una mejora al
 *    preset SÍ se propaga a los tenants que ya lo tienen).
 *  · CON entrada Y el valor ACTUAL DIFIERE del snapshot → el dueño lo cambió → se PRESERVA el valor
 *    del dueño.
 * En LOS TRES casos el snapshot queda en lo que el preset declara AHORA — es la base de comparación
 * de la PRÓXIMA vez, no un historial: así, si el valor preservado del dueño sigue sin coincidir con
 * lo que el preset declara (el caso normal de un override deliberado), la SIGUIENTE re-aplicación
 * sigue detectándolo como tocado, aunque el preset haya cambiado de valor entre medio.
 *
 * GRANULARIDAD: por CAMPO HOJA — `tema.fondo`, `cromo.navTinta`, `<seccion>.variante`,
 * `<banda>.visible`, `hero.ctasVisibles`, `menu.badgeItem`… — EXCEPTO `esquemas`, `orden` y
 * `variantesBandas`, que se fusionan como BLOB ENTERO (como ya se reemplazaban enteros antes de este
 * slice): ninguna de las tres tiene hoy una superficie donde el dueño edite una entrada suelta
 * (§ PENDIENTE_PANEL, `panel-controles.ts`: «SIN PICKER, decisión del owner: se compone en el
 * onboarding»), así que la única forma en que su valor ACTUAL puede diferir del snapshot es por
 * OTRO preset aplicado encima — la misma "PROPIEDAD CONOCIDA" de siempre (ver el párrafo final),
 * no una edición del dueño que haya que preservar campo por campo.
 *
 * INVARIANTE (la promesa del runbook): NUNCA toca un texto ni una imagen del dueño. Sólo escribe,
 * campo por campo vía la fusión de arriba, `tema` (raíces + par + forma + los dos ejes de origen de
 * § TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1 + escalaDisplay — son composición, no contenido), `cromo`
 * (§ CROMO-NAV-FOOTER-TEMATIZABLE-1, los 3 ejes de chrome de nav/footer, META APARTE de `tema` a
 * propósito, ver el docstring de `CromoContent`), `volverArriba` (§ CROMO-VOLVER-ARRIBA-1, el botón
 * flotante — META PROPIA, aparte de `cromo`, ver el docstring de `VolverArribaContent`),
 * `rielSocial` (§ CROMO-RIEL-SOCIAL-1, el riel social — META PROPIA, aparte de `cromo` y de
 * `volverArriba`, ver el docstring de `RielSocialContent`), `carritoEnvio` (§ MUESTRARIO-CARRITO-
 * BARRA-ENVIO-1, la barra de envío gratis del carrito — META PROPIA, aparte de `cromo`,
 * `volverArriba` y `rielSocial`, ver el docstring de `CarritoEnvioContent`), `navTratamiento`
 * (§ CROMO-NAV-TRATAMIENTO-1, el tratamiento tipográfico de los links del nav — META PROPIA, aparte
 * de `cromo`/`volverArriba`/`rielSocial`/`carritoEnvio`, ver el docstring de
 * `NavTratamientoContent`), `navWordmark`
 * (§ CORTE-LOGO-APILADO-1, el tratamiento tipográfico del wordmark apilado del nav — META PROPIA,
 * aparte de `cromo`/`volverArriba`/`rielSocial`/`carritoEnvio`/`navTratamiento`, ver el docstring de
 * `NavWordmarkContent`), `esquemas`, `orden` y `variantesBandas` (fusionados como BLOB, § arriba),
 * el campo `variante` DENTRO de cada sección afectada — preservando cualquier otro campo que esa
 * sección ya tuviera (`{ ...prev, variante }`) —, el campo `visible` DENTRO de cada banda que
 * `preset.bandasVisibles` declara (§ MUESTRARIO-BANDA-APAGABLE-1, mismo `{ ...prev, visible }`,
 * MISMA razón: es composición —qué banda se ve, no qué dice—, no contenido del dueño; encender Y
 * apagar, sobre CUALQUIER `BandaId` con sección propia), y, SÓLO cuando la variante resultante de
 * `featured` es 'spotlight' (§ SPOTLIGHT-CABLEADO-HOME-1), el campo `visible` DENTRO de
 * `content.spotlight` (mismo mecanismo, para una banda ESTRUCTURAL sin `BandaId` propio — `featured`
 * no está en `BANDA_IDS`, así que no puede pasar por `bandasVisibles`) — más `content.presetSnapshot`
 * mismo (la contabilidad de esta fusión, § arriba). Ninguna otra clave de `content` se toca.
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
 * PROPIEDAD CONOCIDA, ACOTADA por este slice pero no cerrada del todo: la fusión NO está scopeada por
 * `preset.clave` — el snapshot recuerda "lo último que este motor escribió", sin importar qué preset
 * lo escribió. Reaplicar el MISMO preset sobre un tenant que lo afinó a mano preserva sus ajustes
 * (el caso que este slice resuelve). Aplicar un preset DISTINTO sobre un tenant que nunca tocó nada
 * a mano también funciona bien —nada que preservar, todo se propaga—, pero un tenant que afinó
 * campos a mano y LUEGO recibe un preset distinto puede ver esos campos sobreescritos si el nuevo
 * preset declara para ellos el MISMO valor que el snapshot recordaba (una coincidencia, no una
 * garantía). Hoy el dueño nunca compone —un tenant corre UN preset fijo desde el onboarding, nunca
 * dos— así que este caso sigue sin ocurrir en la práctica; scopear el snapshot por preset es la
 * salida el día que sí ocurra, y no se construye acá.
 */
export function mergePresetEnContent(content: Record<string, unknown>, preset: PresetTema): Record<string, unknown> {
  const out: Record<string, unknown> = { ...content };

  // EL SNAPSHOT PREVIO vive DENTRO de `content` (una meta más de `SiteContentData`), así que la
  // fusión no necesita un canal aparte: `aplicarPreset` y el mirador ya pasan `content` completo, y
  // el snapshot viaja con él sin tocar ningún llamador (§ site-content-write.ts, theme-mirador.ts —
  // ninguno de los dos está en el `touches:` de este slice, ni hace falta que lo esté).
  const snapshotPrevio = esObj(content.presetSnapshot) ? (content.presetSnapshot as Record<string, unknown>) : {};
  const snapshotNuevo: Record<string, unknown> = {};

  // FUSIONA un campo por su RUTA punteada: ver el docstring de arriba para las tres ramas. Actualiza
  // `snapshotNuevo` SIEMPRE, en las tres — es la base de comparación de la próxima vez, no el valor
  // que terminó escrito esta vez.
  const fusionar = (ruta: string, nuevo: unknown): unknown => {
    const tieneSnapshot = Object.prototype.hasOwnProperty.call(snapshotPrevio, ruta);
    const actual = leerRuta(content, ruta);
    const dueñoLoTocó = tieneSnapshot && !igualValor(actual, snapshotPrevio[ruta]);
    snapshotNuevo[ruta] = nuevo;
    return dueñoLoTocó ? actual : nuevo;
  };

  out.tema = {
    fondo: fusionar('tema.fondo', preset.raices.fondo),
    tinta: fusionar('tema.tinta', preset.raices.tinta),
    acento: fusionar('tema.acento', preset.raices.acento),
    fuentePar: fusionar('tema.fuentePar', resolverFuentePar(preset.fuentePar)),
    forma: fusionar('tema.forma', resolverForma(preset.forma)),
    // AUSENTE en el preset → null (el default, byte-idéntico) — el mismo `?? null` que ya hace
    // falta para escribir un `TemaContent` completo (§ TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1).
    origenTexto: fusionar('tema.origenTexto', preset.origenTexto ?? null),
    origenAccion: fusionar('tema.origenAccion', preset.origenAccion ?? null),
    // AUSENTE en el preset → null (el default, byte-idéntico) — § TEMAS-ESCALA-DISPLAY-1.
    escalaDisplay: fusionar('tema.escalaDisplay', preset.escalaDisplay ?? null),
  };
  // `cromo` (§ CROMO-NAV-FOOTER-TEMATIZABLE-1): meta APARTE de `tema` — ver el docstring de
  // `CromoContent` para el porqué (el guardar/publicar de la paleta reemplaza `tema` entero y
  // resetearía estos 3 ejes en silencio si vivieran ahí).
  out.cromo = {
    navTinta: fusionar('cromo.navTinta', preset.navTinta ?? false),
    navSubtitulo: fusionar('cromo.navSubtitulo', preset.navSubtitulo ?? false),
    navBadge: fusionar('cromo.navBadge', preset.navBadge ?? ''),
  };
  // `volverArriba` (§ CROMO-VOLVER-ARRIBA-1): meta PROPIA, aparte de `cromo` — ver el docstring de
  // `VolverArribaContent` para el porqué (no comparte el contrato exhaustivo de 3 claves de `cromo`,
  // afirmado por `cromo-tematizable.test.ts`).
  out.volverArriba = {
    visible: fusionar('volverArriba.visible', preset.volverArribaVisible ?? false),
  };
  // `rielSocial` (§ CROMO-RIEL-SOCIAL-1): meta PROPIA, aparte de `cromo` Y de `volverArriba` — ver
  // el docstring de `RielSocialContent` para el porqué (MISMA razón que `volverArriba`: no comparte
  // el contrato exhaustivo de 3 claves de `cromo`, afirmado por `cromo-tematizable.test.ts`; y no se
  // fusiona con `volverArriba` porque ese dominio ya cerró SU propio contrato de 1 clave).
  out.rielSocial = {
    visible: fusionar('rielSocial.visible', preset.rielSocialVisible ?? false),
  };
  // `carritoEnvio` (§ MUESTRARIO-CARRITO-BARRA-ENVIO-1): meta PROPIA, aparte de `cromo`,
  // `volverArriba` Y `rielSocial` — ver el docstring de `CarritoEnvioContent` para el porqué (MISMA
  // razón que `volverArriba`/`rielSocial`: no comparte el contrato exhaustivo de 3 claves de
  // `cromo`, afirmado por `cromo-tematizable.test.ts`; y no se fusiona con ninguna de las otras dos
  // porque cada una ya cerró SU propio contrato de 1 clave).
  out.carritoEnvio = {
    visible: fusionar('carritoEnvio.visible', preset.carritoEnvioVisible ?? false),
  };
  // `navTratamiento` (§ CROMO-NAV-TRATAMIENTO-1): meta PROPIA, aparte de `cromo`, `volverArriba`,
  // `rielSocial` Y `carritoEnvio` — ver el docstring de `NavTratamientoContent` para el porqué
  // (conceptualmente es la misma familia que `navTinta`/`navSubtitulo`/`navBadge`, pero no puede
  // compartir el contrato exhaustivo de 3 claves de `cromo`, afirmado por
  // `cromo-tematizable.test.ts`, FUERA de `touches:` de este slice).
  out.navTratamiento = {
    activo: fusionar('navTratamiento.activo', preset.navTratamientoActivo ?? false),
  };
  // `navWordmark` (§ CORTE-LOGO-APILADO-1): meta PROPIA, aparte de `cromo`, `volverArriba`,
  // `rielSocial`, `carritoEnvio` Y `navTratamiento` — ver el docstring de `NavWordmarkContent` para
  // el porqué (no es el mismo eje que `navTratamiento`: aquél trata los links del nav, éste el
  // wordmark apilado).
  out.navWordmark = {
    activo: fusionar('navWordmark.activo', preset.navWordmarkActivo ?? false),
  };
  // `navDrawerMovil` (§ MUESTRARIO-DRAWER-MOVIL-TEMA-1): meta PROPIA, aparte de `cromo`,
  // `volverArriba`, `rielSocial`, `navTratamiento` Y `navWordmark` — ver el docstring de
  // `NavDrawerMovilContent` para el porqué (VARIANTE de forma, no un ajuste ON/OFF; no comparte el
  // contrato exhaustivo de 3 claves de `cromo`, afirmado por `cromo-tematizable.test.ts`).
  out.navDrawerMovil = {
    variante: fusionar('navDrawerMovil.variante', preset.navDrawerMovilVariante ?? 'dropdown'),
  };
  // `carrito` (§ MUESTRARIO-CARRITO-COMPOSICION-1): meta PROPIA, aparte de `cromo`, `volverArriba`,
  // `rielSocial`, `carritoEnvio`, `navTratamiento`, `navWordmark` Y `navDrawerMovil` — ver el
  // docstring de `CarritoContent` para el porqué (VARIANTE de forma del cajón entero, no un ajuste
  // ON/OFF; NO comparte objeto con `carritoEnvio`, que es la barra de progreso de envío gratis, otro
  // eje del mismo carrito).
  out.carrito = {
    variante: fusionar('carrito.variante', preset.carritoVariante ?? 'anclado'),
  };
  // `esquemas`/`orden` — fusión de BLOB ENTERO, no por banda (§ el docstring de arriba, "GRANULARIDAD").
  out.esquemas = fusionar('esquemas', { ...preset.esquemas });
  out.orden = fusionar('orden', [...preset.orden]);

  const registro = REGISTRY as Record<string, SeccionDef | undefined>;
  const variantesBandas: Record<string, string> = {};
  for (const [seccion, variante] of Object.entries(preset.variantes)) {
    if (registro[seccion]) {
      const prev = esObj(out[seccion]) ? out[seccion] : {};
      out[seccion] = { ...prev, variante: fusionar(`${seccion}.variante`, variante) };
    } else {
      variantesBandas[seccion] = variante;
    }
  }
  // `variantesBandas` — BLOB ENTERO, misma razón que `esquemas`/`orden` arriba.
  out.variantesBandas = fusionar('variantesBandas', variantesBandas);

  // SPOTLIGHT COMO VARIANTE DE `featured` (§ SPOTLIGHT-CABLEADO-HOME-1): `Spotlight.tsx` (NO
  // reescrito por este slice) revisa `seccionEsVisible(REGISTRY.spotlight, spotlight)` ANTES de
  // pintar un solo nodo — el mismo gate que protege a `DEFAULTS.spotlight` de encenderse SOLA
  // (§ site-content-defaults.ts, "nace OFF"; ese default sigue en `false`, sin tocar, porque el
  // motivo mecánico que lo justifica —`spotlight` fuera de `BANDA_IDS`— sigue vigente). Pero un
  // preset que ELIGE la variante 'spotlight' para `featured` está pidiendo, por definición, que esa
  // banda se VEA: sin esto, CORTE aplicaría la variante y `Spotlight` devolvería `null`
  // (`spotlight.visible` seguiría en su default `false`), dejando el slot de `featured` vacío — la
  // variante "elegida" y "en blanco" a la vez. Se enciende SÓLO cuando la variante RESULTANTE (ya
  // fusionada — el valor que de verdad va a quedar escrito, dueño incluido) es 'spotlight' (nunca
  // para 'cuadricula'/'grilla', ni para ningún otro preset), preservando cualquier otro campo que la
  // sección ya tuviera (`{ ...prev, visible: … }`, igual que el `variante` de arriba) — así un
  // tenant que ya haya editado `eyebrow`/`titulo`/el pin no los pierde al aplicar el preset.
  if ((out.variantesBandas as Record<string, string>).featured === 'spotlight' && registro.spotlight) {
    const prevSpotlight = esObj(out.spotlight) ? out.spotlight : {};
    out.spotlight = { ...prevSpotlight, visible: fusionar('spotlight.visible', true) };
  }

  // BANDAS VISIBLES (§ MUESTRARIO-BANDA-APAGABLE-1) — GEMELO GENERAL del exception de spotlight de
  // arriba, pero para bandas PROPIAS en `BANDA_IDS` (con sección real en el REGISTRY), no una
  // variante de `featured`. Reemplaza los dos bloques dedicados que existían antes de este slice
  // (uno para `origen`, uno para `marquesina`, cada uno con su propio booleano `bandaOrigenVisible`/
  // `bandaMarquesinaVisible`) por UN loop sobre `preset.bandasVisibles` — la misma razón mecánica
  // que ya regía a los dos: `orden` es universal (`ORDEN_DEFAULT = [...BANDA_IDS]` alimenta también
  // a ARRANQUE/VITRINA/PATIO), así que estar en el `orden` no alcanza como señal, ni de encendido ni
  // de apagado. La señal es SIEMPRE el mapa explícito; AUSENTE una banda del mapa = no se toca su
  // `visible` (el resolver aplica su propio default). `registro[banda]` sigue siendo la guarda: sólo
  // las bandas con sección real en `SiteContentData` (no `featured`, que es estructural) tienen
  // dónde escribir un `visible`.
  for (const [banda, visible] of Object.entries(preset.bandasVisibles ?? {})) {
    if (typeof visible !== 'boolean' || !registro[banda]) continue;
    const prev = esObj(out[banda]) ? out[banda] : {};
    out[banda] = { ...prev, visible: fusionar(`${banda}.visible`, visible) };
  }

  // HERO TOGGLES (§ TEMAS-HERO-TOGGLES-PRESET-1) — GEMELO de la escritura de `variante` en el loop
  // de `preset.variantes` de arriba, no de los bloques de banda de arriba: `hero` YA es una sección
  // del REGISTRY (siempre se muestra), así que acá no hay nada que "encender" — sólo dos booleanos
  // DENTRO de la sección que se escriben SÓLO si el preset los declara explícitamente, preservando
  // el resto de `content.hero` (`variante` incluida, si el mismo preset la pidió arriba) con
  // `{ ...prevHero, … }`. AUSENTE en el preset → no se toca ninguna de las dos claves, y el resolver
  // aplica su propio default (`true`/`false`) — el mismo mecanismo que ya deja `fraseAlPie` (CONTENIDO,
  // nunca escrita por un preset) intacta.
  if ((typeof preset.heroCtasVisibles === 'boolean' || typeof preset.heroCueDesliza === 'boolean'
      || typeof preset.heroTitularVisible === 'boolean' || typeof preset.heroSubtituloVisible === 'boolean'
      || typeof preset.heroAlturaLlena === 'boolean')
      && registro.hero) {
    const prevHero = esObj(out.hero) ? out.hero : {};
    out.hero = {
      ...prevHero,
      ...(typeof preset.heroCtasVisibles === 'boolean' ? { ctasVisibles: fusionar('hero.ctasVisibles', preset.heroCtasVisibles) } : {}),
      ...(typeof preset.heroCueDesliza === 'boolean' ? { cueDesliza: fusionar('hero.cueDesliza', preset.heroCueDesliza) } : {}),
      // DOS MÁS (§ CORTE-HERO-TITULAR-OCULTABLE-1), mismo mecanismo: escriben SÓLO si el preset los
      // declara explícitamente.
      ...(typeof preset.heroTitularVisible === 'boolean' ? { titularVisible: fusionar('hero.titularVisible', preset.heroTitularVisible) } : {}),
      ...(typeof preset.heroSubtituloVisible === 'boolean' ? { subtituloVisible: fusionar('hero.subtituloVisible', preset.heroSubtituloVisible) } : {}),
      // UNO MÁS (§ CORTE-HERO-VIEWPORT-LLENO-1), mismo mecanismo.
      ...(typeof preset.heroAlturaLlena === 'boolean' ? { alturaLlena: fusionar('hero.alturaLlena', preset.heroAlturaLlena) } : {}),
    };
  }

  // MENU BADGE (§ CORTE-BADGE-COSECHA-EN-MENU-1) — GEMELO EXACTO de HERO TOGGLES, arriba: `menu` YA
  // es una sección del REGISTRY (siempre se muestra), así que acá no hay nada que "encender" — sólo
  // dos campos DENTRO de la sección que se escriben SÓLO si el preset los declara explícitamente,
  // preservando el resto de `content.menu` (labels/posiciones/CTA) con `{ ...prevMenu, … }`. AUSENTE
  // en el preset → no se toca ninguna de las dos claves, y el resolver aplica su propio default
  // (`''` = sin badge) — el mismo mecanismo que ya deja `labelTienda`/`ctaLabel` (CONTENIDO, nunca
  // escritos por un preset) intactos. El badge deja de envolver el LOGO (`cromo.navBadge`, que CORTE
  // sigue declarando pero que `StoreNav.tsx` ya no lee, § el docstring de esa sección) y pasa a ser
  // este atributo del ítem del menú.
  if ((typeof preset.menuBadgeItem === 'string' || typeof preset.menuBadgeTexto === 'string') && registro.menu) {
    const prevMenu = esObj(out.menu) ? out.menu : {};
    out.menu = {
      ...prevMenu,
      ...(typeof preset.menuBadgeItem === 'string' ? { badgeItem: fusionar('menu.badgeItem', preset.menuBadgeItem) } : {}),
      ...(typeof preset.menuBadgeTexto === 'string' ? { badgeTexto: fusionar('menu.badgeTexto', preset.menuBadgeTexto) } : {}),
    };
  }

  out.presetSnapshot = snapshotNuevo;
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
  //     tinta — 'neutro' (§ CORTE-HISTORIA-COLOR-FOTOS-1, DECISIONS.md, la re-medida que reemplazó
  //     esta asignación). 'superficie' (el tibio de 9% acento) daba #f3eadb — otra FAMILIA que el
  //     gris frío `--surface-page-cool` del prototipo (#f0f0ec): un mix hacia el acento (rojo en
  //     CORTE) no puede dar frío, sea cual sea el peso. `neutro` mezcla el fondo hacia la TINTA en
  //     vez del acento —la QUINTA superficie del set, construida en este slice— y da #f2f0ea,
  //     calibrado corriendo el motor real contra el objetivo medido (§ `PESO_NEUTRO`,
  //     `palette-derive.ts`).
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
    brandStory: 'neutro',
    origen: 'crema',
    presentaciones: 'crema',
    subscriptionCTA: 'crema',
  },
  // `orden` PROPIO (§ MUESTRARIO-BANDA-APAGABLE-1) — ANTES de este slice CORTE usaba `ORDEN_DEFAULT`
  // (la secuencia de Nayoli, no la del prototipo). MEDIDO contra `docs/prototipos/cafeone/
  // index.html` (`CENSO-MUESTRARIO-1`): `<main>` monta, EN ESTE ORDEN, `.hero` (120-140),
  // `.marquee` (142-159), `.section.spotlight#producto` (160-225), `.section#presentaciones`
  // (226-249), `.section.historia#historia` (250-275), `.section#origen` (276-312) y
  // `.cta-strip` (313-322) — sin franja de `trustBadges` ni de `testimonials` en absoluto. Ese es
  // el `orden` que se declara acá; `resolverOrden` reinserta `trustBadges`/`testimonials` al final
  // (en su posición canónica, § BANDA_IDS) porque su dominio es CERRADO y siempre completa la lista
  // de 9 — pero las dos quedan APAGADAS por `bandasVisibles` (abajo), así que su posición en la cola
  // no importa: nunca rinden un nodo.
  orden: ['hero', 'marquesina', 'featured', 'presentaciones', 'brandStory', 'origen', 'subscriptionCTA'],
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
  // (`.wordmark small`, `index.html:23`, "San Adolfo · Huila").
  //
  // `navBadge` SIGUE DECLARADO, PERO DORMIDO (§ CORTE-BADGE-COSECHA-EN-MENU-1) — `StoreNav.tsx` ya
  // no lo lee para envolver el LOGO (§ el docstring de esa sección). Se DEJA en `'Cosecha 2026'`, sin
  // vaciarlo, a propósito: `cromo-tematizable.test.ts` (FUERA de `touches:` de este slice) afirma
  // `CORTE.navBadge === 'Cosecha 2026'` Y `mergePresetEnContent(_, CORTE).cromo.navBadge ===
  // 'Cosecha 2026'` — vaciarlo habría roto ese archivo sin poder tocarlo (el spec de este slice pedía
  // "poné `CORTE.navBadge` en vacío"; la medición contra el test existente gana, § CLAUDE.md "cuando
  // una medición contradice la instrucción, la medición gana" — DESVÍO, reportado en el asiento de
  // este slice). El campo queda como candidato a retiro (junto con `CromoContent.navBadge`), no
  // retirado acá.
  navTinta: true,
  navSubtitulo: true,
  navBadge: 'Cosecha 2026',
  // menuBadgeItem/menuBadgeTexto (§ CORTE-BADGE-COSECHA-EN-MENU-1) — el badge de cosecha del
  // prototipo (`.badge`, `index.html:32`, "Cosecha 2026") junto al PRIMER `.nav-item`
  // ("Nuestro café", `index.html:27-32`) — el ítem que en nuestro set cerrado corresponde a
  // `'tienda'` (`MENU_PATHS.tienda === '/tienda'`, § site-content-defaults.ts). ÉSTE es hoy el
  // mecanismo VIVO del badge: `itemsDeMenu` lo resuelve en el ítem cuyo id coincide con
  // `menuBadgeItem`, y `StoreNav.tsx` lo pinta junto a ese link. `menuBadgeTexto` lleva el MISMO
  // texto exacto que antes llevaba `navBadge` (arriba) — el valor de MUESTRARIO de este preset
  // (§ el docstring de `MenuContent.badgeItem`/`.badgeTexto`: es dato del tenant, no un año horneado
  // en el componente).
  menuBadgeItem: 'tienda',
  menuBadgeTexto: 'Cosecha 2026',
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
  // bandasVisibles (§ MUESTRARIO-BANDA-APAGABLE-1) — ver el docstring del campo en `PresetTema`,
  // arriba. REEMPLAZA a los dos booleanos dedicados (`bandaOrigenVisible: true` /
  // `bandaMarquesinaVisible: true`) que CORTE era el único en declarar, Y AGREGA el apagado que
  // antes era IMPOSIBLE: `trustBadges`/`testimonials` nacen `visible:true` (§ DEFAULTS,
  // site-content-defaults.ts) y el prototipo no tiene franja para ninguna de las dos (§ el
  // comentario de `orden`, arriba — `CENSO-MUESTRARIO-1` no encontró `.badges`/`.testimonials` en
  // `index.html`), así que sin esta capacidad el mirador mostraba una banda que el diseño no pide.
  // Verificado ANTES de apagarlas: las dos son `ocultable:true` en el REGISTRY
  // (`REGISTRY.trustBadges.ocultable`/`REGISTRY.testimonials.ocultable`, site-content-defaults.ts).
  //   origen/marquesina → `true`: la marquesina hereda su POSICIÓN 2ª (justo tras `hero`) del
  //     `orden` propio, arriba, sin necesidad de un array separado; NINGÚN esquema propio en
  //     `esquemas` (arriba) — su fondo lo da su propia canónica OSCURA (`BANDAS_OSCURAS`,
  //     `bg-[var(--sf-banda,var(--sf-tinta))]`), igual que `hero` —el prototipo pinta
  //     `.marquee{background:var(--green-900)}` bajo la foto velada, la MISMA raíz `tinta` que ya
  //     gobierna esa canónica—, así que asignarle un esquema sería una segunda fuente de verdad
  //     discrepando con la que ya la pinta bien.
  //   trustBadges/testimonials → `false`: apagadas, sin análogo en el prototipo.
  bandasVisibles: { origen: true, marquesina: true, trustBadges: false, testimonials: false },
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
  // heroTitularVisible/heroSubtituloVisible (§ CORTE-HERO-TITULAR-OCULTABLE-1) — MEDIDO contra el
  // prototipo (`docs/prototipos/cafeone/index.html:130-138`): `.hero-inner` no lleva eyebrow,
  // titular ni subtítulo, sólo `.hero-caption`/`.scroll-cue`. CORTE es hoy el ÚNICO preset que
  // declara los dos; los otros cinco no tocan `content.hero.titularVisible`/`subtituloVisible`.
  heroTitularVisible: false,
  heroSubtituloVisible: false,
  // heroAlturaLlena (§ CORTE-HERO-VIEWPORT-LLENO-1) — MEDIDO contra el prototipo: `.hero`
  // (`docs/prototipos/cafeone/css/app.css:358-362`) es `height:calc(100vh - (var(--frame-gap) * 2))`
  // con `min-height:640px` — el viewport COMPLETO, no un 92% fijo. El owner, gateando `?tema=CORTE`
  // (2026-09-23): «el hero no llena la pantalla: termina antes del borde inferior y asoma debajo la
  // foto velada de la marquesina». CORTE es hoy el ÚNICO preset que lo declara; los otros cinco no
  // tocan `content.hero.alturaLlena`.
  heroAlturaLlena: true,
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
  // carritoEnvioVisible (§ MUESTRARIO-CARRITO-BARRA-ENVIO-1) — MEDIDO contra el prototipo:
  // `.ship-prog`/`.ship-bar` (`docs/prototipos/cafeone/index.html:409-411`,
  // `css/app.css:731-736`) es el mensaje + barra de progreso hacia el envío gratis que reemplaza a
  // la frase estática de HOY dentro del cajón del carrito (`.drawer-body`, la MISMA superficie que
  // ya viste `raices.tinta`/`navTinta` de CORTE). CORTE es hoy el ÚNICO preset del catálogo que lo
  // declara; los otros cinco no tocan `content.carritoEnvio`.
  carritoEnvioVisible: true,
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
  // navDrawerMovilVariante (§ MUESTRARIO-DRAWER-MOVIL-TEMA-1) — MEDIDO contra el prototipo:
  // `.mobile-nav` (`docs/prototipos/cafeone/css/app.css:300-321`) es un panel `position:fixed;
  // inset:var(--frame-gap)` (12px) con `border-radius:var(--frame-radius)` (14px),
  // `background:var(--surface-inverse)` (la MISMA tinta de `raices.tinta`), cabecera propia
  // (`.mobile-nav-head`, `index.html:94-97`: wordmark + botón cerrar, `margin-bottom:var(--space-10)`
  // = 40px) y los links (`a.m-link`, `index.html:98-105`) con entrada ESCALONADA
  // (`animation-delay:calc(var(--i,0) * 60ms + 80ms)`, `420ms var(--ease-out)`, opacity 0→1 +
  // `translateY(14px)`→0) — el dropdown angosto de HOY no tiene ninguna de las dos piezas
  // (cabecera propia, escalonado). CORTE es hoy el ÚNICO preset del catálogo que lo declara; los
  // otros cinco no tocan `content.navDrawerMovil`.
  navDrawerMovilVariante: 'pantallaCompleta',
  // carritoVariante (§ MUESTRARIO-CARRITO-COMPOSICION-1) — MEDIDO contra el prototipo: `.drawer`
  // (`docs/prototipos/cafeone/css/app.css:708-717`) es un panel `position:fixed;top/bottom/right:
  // var(--frame-gap)` (12px, separado de los tres bordes libres) con `border-radius:0
  // var(--frame-radius) var(--frame-radius) 0` (14px, redondeado sólo del lado que mira al borde
  // de pantalla), `background:var(--surface-page)` (la superficie de PÁGINA, no la de tarjeta) y su
  // cabecera (`.drawer-head h2`, `app.css:723-724`) en `font-size:var(--text-h1)` (38px) +
  // `font-weight:var(--weight-regular)` (400) — el cajón pegado al borde de HOY no tiene ninguna de
  // las tres piezas (separado del borde, radio parcial, fondo de página; su cabecera es
  // `font-semibold` sin tamaño declarado). El ANCHO (`--drawer-width`, 880px) no tiene equivalente
  // en este sistema y NO se aplica (§ el docstring de `CarritoContent`). CORTE es hoy el ÚNICO
  // preset del catálogo que lo declara; los otros cinco no tocan `content.carrito`.
  carritoVariante: 'flotante',
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
