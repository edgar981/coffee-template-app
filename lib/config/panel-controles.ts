// EL CHEQUEO DERIVADO (§ PANEL-REFLEJA-TIENDA-CHEQUEO-1): "todo campo de contenido que la tienda LEE
// tiene su control en el panel". No es una lista a mano de "campos vs. controles" — eso es exactamente
// la clase de doble-lista que ya mordió dos veces en este repo (`CATEGORIAS ≠ CATEGORIA_LABELS` en C3,
// `presentacionesEditableSchema` congelado en C1, § site-content-schema.ts). Acá LOS DOS LADOS SE
// DERIVAN de declaraciones que ya existen — el REGISTRY (lo que la tienda resuelve) y `SECCIONES_TIENDA`
// (lo que el editor genérico renderiza) — y sólo el TERCER lado, la EXCEPCIÓN, es una lista escrita a
// mano, porque una excepción es justamente lo que no se puede derivar: es una decisión.
//
// GRANULARIDAD: un "campo" es una ruta plana `seccion.campo` (o `seccion.items.campo` para el campo de
// un ítem de repeater, o `meta.campo`/`meta.sub.campo` para las claves NO-sección). Es la misma
// granularidad que exige la calibración del owner: `cromo.navSubtitulo` tiene que poder nombrarse solo,
// no perderse dentro de "cromo" como bloque.
//
// EL LADO "LEÍDO POR LA TIENDA" se deriva de `REGISTRY` (site-content-defaults.ts): `campos` +
// `booleanos` + (`variante` si la sección declara `variantes`) + las claves de `escalares` +
// (`visible` si la sección es `ocultable`) — es exactamente el inventario que `resolverSiteContent`
// ya usa para decidir qué escribe cada sección; no es un segundo inventario paralelo, es leer el que
// ya gobierna el resolver. Más las SIETE claves NO-sección con forma fija (`paginas`, `tema`, `cromo`,
// `volverArriba`, `rielSocial`, `navTratamiento`, `navWordmark`), leídas de `DEFAULTS` en runtime.
//
// LO QUE QUEDA AFUERA A PROPÓSITO — `esquemas`, `orden`, `variantesBandas` — NO por una lista de
// excepciones, sino porque NUNCA ENTRAN al lado "leído": son dominio ABIERTO (`esquemas`/
// `variantesBandas` son `Record<string, X>` sin claves fijas — cualquier bandaId puede tener entrada;
// `orden` es un array de reordenamiento, no un objeto con campos nombrados). Un chequeo por-campo no
// tiene NADA que enumerar ahí — no es que se decida omitirlos, es que la forma del dato no tiene
// "campos". Se componen en el onboarding (decisión del owner, ya asentada en CLAUDE.md, § el docstring
// de `EsquemasContent`/`VariantesBandasContent`/`OrdenContent` en site-content-defaults.ts), no en un
// picker del panel.
//
// EL LADO "CONTROLADO POR EL PANEL" se deriva de DOS fuentes, porque hay DOS mecanismos de edición:
//  1. Las diez secciones de `SECCIONES_TIENDA` (tienda-secciones.ts) que `TiendaSeccionEditor` renderiza
//     GENÉRICAMENTE: se deriva de `config.campos` + `config.imagenes` + (`visible` si `config.ocultable`)
//     + `config.booleanos` (los interruptores de sección, § PANEL-EDITOR-HERO-TOGGLES-1) +
//     `config.repeater.campos`, para cada una.
//  2. Los editores BESPOKE (`MenuSeccion`, `PaletaSeccion`, `TiendaPaginas`) — `menu`, `tema` y `paginas`
//     NO pasan por `TiendaSeccionEditor` (§ CROMO-MENU-PANEL-EDITOR-1: `menu` tiene sección en el
//     REGISTRY, pero su editor es su propio componente; `tema` ni siquiera es sección del REGISTRY).
//     Lo que cada uno controla NO se puede derivar automáticamente —no hay un `config` declarativo que
//     leer, es JSX bespoke—, así que se DECLARA acá, leyendo el código de cada editor. Es la "declaración
//     explícita por editor" del spec: no una lista central inventada, sino la lectura de lo que cada
//     bespoke YA hace, puesta en un solo sitio para que el chequeo la consulte.
//
// LA EXENCIÓN PENDIENTE-PANEL es la ÚNICA lista a mano de este archivo, y es DECRECIENTE por diseño:
// cada entrada nombra el campo Y el slice que lo va a cerrar. El día que ese slice construya el editor,
// el campo pasa a "controlado" (vía 1 o 2) y su entrada acá SOBRA — el test de higiene (abajo) falla si
// una entrada de PENDIENTE_PANEL ya está controlada, forzando a borrarla. La lista nunca puede crecer
// en silencio: agregar una entrada sin agregar el campo real a `camposLeidosPorTienda()` no hace nada
// (no hay nada que exentar), y agregar un campo real sin exentarlo ni controlarlo pone el gate en rojo.

import { REGISTRY, DEFAULTS, type SeccionKey } from './site-content-defaults';
import { SECCIONES_TIENDA, type SeccionConfig } from '@/components/admin/tienda-secciones';

// ─── LADO A: lo que la tienda LEE ──────────────────────────────────────────────────────────────────

/** Las siete claves NO-sección con forma FIJA (un objeto con campos nombrados, no un `Record` abierto).
 *  `esquemas`/`orden`/`variantesBandas` NO están acá — dominio abierto, § el comentario de cabecera. */
const METAS_CON_CAMPOS = ['paginas', 'tema', 'cromo', 'volverArriba', 'rielSocial', 'navTratamiento', 'navWordmark'] as const;
type MetaConCampos = (typeof METAS_CON_CAMPOS)[number];

/** Los campos que `resolverSiteContent`/el escritor resuelven para UNA sección, derivados de su
 *  entrada en `REGISTRY` — el mismo inventario que ya gobierna al resolver, no uno paralelo. */
function camposDeSeccion(key: SeccionKey): string[] {
  const def = REGISTRY[key];
  const campos = new Set<string>(Object.keys(def.campos));
  for (const b of def.booleanos ?? []) campos.add(b);
  if (def.variantes) campos.add('variante');
  for (const e of Object.keys(def.escalares ?? {})) campos.add(e);
  if (def.ocultable) campos.add('visible');
  return [...campos].sort().map((c) => `${key}.${c}`);
}

/** Los campos de UN ÍTEM de repeater, si la sección tiene uno — derivados de `REGISTRY[key].repeater.
 *  campos`. ALCANCE: sólo los campos STRING requerido/opcional que el resolver rellena (el mismo límite
 *  que ya declara `site-content-schema.test.ts`, "ALCANCE: primer nivel... los campos de ÍTEM de los
 *  repeaters NO se derivan de DEFAULTS"): un campo no-string de ítem (p. ej. `stars`, un rating numérico
 *  que el resolver pasa tal cual) no entra al lado "leído" de este chequeo. No es una omisión silenciosa
 *  de ese campo: `stars` SÍ tiene control hoy (`RepeaterEditor`, vía `SeccionConfig.repeater.campos` en
 *  tienda-secciones.ts) — sólo que este chequeo, a este alcance, no lo verifica ni en una dirección ni
 *  en la otra. Ampliar el alcance a campos de ítem no-string es trabajo aparte, con el mismo costo que
 *  ya pagó `site-content-schema.test.ts` por la misma razón. */
function camposDeItemsRepeater(key: SeccionKey): string[] {
  const rep = REGISTRY[key].repeater;
  if (!rep) return [];
  return Object.keys(rep.campos).sort().map((c) => `${key}.items.${c}`);
}

/** Los campos de una meta NO-sección, leídos de `DEFAULTS` en RUNTIME (no una lista a mano de sus
 *  claves): `paginas` es un caso especial porque cada página es un objeto `{visible}` — se aplana a
 *  `paginas.<pagina>.visible`; las otras seis son objetos planos de un nivel. */
function camposDeMeta(meta: MetaConCampos): string[] {
  if (meta === 'paginas') {
    return Object.keys(DEFAULTS.paginas).sort().map((p) => `paginas.${p}.visible`);
  }
  const obj = DEFAULTS[meta] as unknown as Record<string, unknown>;
  return Object.keys(obj).sort().map((c) => `${meta}.${c}`);
}

/** TODO campo de contenido que la tienda lee, derivado de `REGISTRY` + `DEFAULTS`. Ésta es la fuente
 *  única del lado "leído" — nadie la edita a mano; crece o encoge sola cuando REGISTRY/DEFAULTS
 *  cambian. */
export function camposLeidosPorTienda(): string[] {
  const seccionKeys = Object.keys(REGISTRY) as SeccionKey[];
  const deSecciones = seccionKeys.flatMap((k) => [...camposDeSeccion(k), ...camposDeItemsRepeater(k)]);
  const deMetas = METAS_CON_CAMPOS.flatMap((m) => camposDeMeta(m));
  return [...deSecciones, ...deMetas].sort();
}

// ─── LADO B: lo que el panel CONTROLA ──────────────────────────────────────────────────────────────

/** Lo que `TiendaSeccionEditor` renderiza para UNA sección de `SECCIONES_TIENDA` (tienda-secciones.ts):
 *  `config.campos` + `config.imagenes` + (`visible` si `config.ocultable`) + `config.booleanos` (los
 *  interruptores de sección, § PANEL-EDITOR-HERO-TOGGLES-1) + `config.repeater.campos` + los `slots`
 *  de todo bloque `tipo:'lista'` en `config.bloques`. Esta ÚLTIMA fuente es necesaria y
 *  no redundante: los campos `benN_M` de `suscripcionPlanes` (los beneficios de cada plan) están
 *  declarados SÓLO en `bloques` (`{tipo:'lista', slots:[...]}`), no en `config.campos` — el propio
 *  comentario de `SUSCRIPCION_PLANES` en tienda-secciones.ts lo dice: "Los benN_* NO llevan
 *  descriptor: la lista los pasa por NOMBRE (§ bloques)". Un bloque `tipo:'tarjeta'`/`'collage'`/
 *  `'seccion'` sólo AGRUPA campos que ya están en `campos`/`imagenes` (doctrina: "el bloque sólo los
 *  AGRUPA") — unirlos de nuevo es inofensivo (un Set no duplica); sólo `'lista'` aporta nombres NUEVOS.
 *  Fue midiendo el gate en rojo con `suscripcionPlanes.ben1_1..ben4_4` como se descubrió esta fuente —
 *  no estaba anticipada al diseñar la derivación. */
function camposDeSeccionEditor(config: SeccionConfig): string[] {
  const s = config.seccion;
  const campos = new Set<string>();
  for (const c of config.campos) campos.add(c.name);
  for (const im of config.imagenes) campos.add(im.name);
  if (config.ocultable) campos.add('visible');
  for (const b of config.booleanos ?? []) campos.add(b.name);
  for (const bloque of config.bloques ?? []) {
    if (bloque.tipo === 'lista') for (const slot of bloque.slots) campos.add(slot);
  }
  const planos = [...campos].sort().map((c) => `${s}.${c}`);
  const items = config.repeater ? [...config.repeater.campos].map((c) => `${s}.items.${c.name}`).sort() : [];
  return [...planos, ...items];
}

/** Lo que las DIEZ secciones de `SECCIONES_TIENDA` cubren, vía el editor genérico. */
const CONTROLADOS_GENERICOS: string[] = SECCIONES_TIENDA.flatMap(camposDeSeccionEditor);

/** DECLARACIÓN EXPLÍCITA de lo que `MenuSeccion.tsx` controla (`menu` NO pasa por `TiendaSeccionEditor`,
 *  § CROMO-MENU-PANEL-EDITOR-1) — leído de su código: las tres etiquetas (`labelTienda`,
 *  `labelSuscripciones`, `labelNosotros`), las tres posiciones de orden, el CTA (`ctaLabel`,
 *  `ctaDestino`) y el BADGE (`badgeItem`, `badgeTexto` — § PANEL-EDITOR-MENU-BADGE-1: el select del
 *  ítem con badge + su texto, con `badgeTexto` atenuado sin ítem elegido). `menu.visible` no aplica —
 *  `REGISTRY.menu.ocultable` es `false`, así que no entra al lado "leído" (§ arriba). */
const CONTROLADOS_MENU_SECCION = [
  'menu.labelTienda', 'menu.labelSuscripciones', 'menu.labelNosotros',
  'menu.posicion1', 'menu.posicion2', 'menu.posicion3',
  'menu.ctaLabel', 'menu.ctaDestino',
  'menu.badgeItem', 'menu.badgeTexto',
];

/** DECLARACIÓN EXPLÍCITA de lo que `PaletaSeccion.tsx` controla (`tema` no es sección del REGISTRY,
 *  § el docstring de `TemaContent`) — leído de su código: las tres raíces de paleta, el par tipográfico
 *  y la forma. NO controla `origenTexto`/`origenAccion`/`escalaDisplay` (§ PENDIENTE_PANEL, abajo — y ya
 *  documentado en el propio `TemaContent`: "NINGÚN escritor real los pone hoy... no hay campo en
 *  `paletaEditableSchema` ni en el editor del panel"). Tampoco controla ningún campo de `cromo`: monta
 *  `<TrustBadges />` para la vista previa, no un editor de cromo. */
const CONTROLADOS_PALETA_SECCION = ['tema.fondo', 'tema.tinta', 'tema.acento', 'tema.fuentePar', 'tema.forma'];

/** DECLARACIÓN EXPLÍCITA de lo que `TiendaPaginas.tsx` controla vía `<TogglePagina>`: el interruptor de
 *  encendido/apagado de cada página apagable. */
const CONTROLADOS_TIENDA_PAGINAS = ['paginas.nosotros.visible', 'paginas.suscripciones.visible'];

/** DECLARACIÓN EXPLÍCITA de lo que `EncabezadoSeccion.tsx` controla (§ PANEL-EDITOR-ENCABEZADO-1):
 *  `cromo`/`navWordmark`/`navTratamiento` NO son secciones del REGISTRY (§ el docstring de
 *  `CONTROLADOS_PALETA_SECCION`, misma familia que `tema`), así que tienen su propia ruta de
 *  publicar/descartar (`/api/site-content/encabezado`) y se declaran acá, leídas de su código: los
 *  cuatro switches — logo (`navWordmark.activo`), sub-encabezado (`cromo.navSubtitulo`), color del
 *  nav (`cromo.navTinta`) y tratamiento del nav (`navTratamiento.activo`). NO controla
 *  `cromo.navBadge` (§ PENDIENTE_PANEL, abajo — superseded por el badge del ítem de menú, que sí
 *  tiene control en `MenuSeccion.tsx`). */
const CONTROLADOS_ENCABEZADO_SECCION = ['navWordmark.activo', 'cromo.navSubtitulo', 'cromo.navTinta', 'navTratamiento.activo'];

/** TODO campo de contenido con control en el panel HOY. */
export function camposControladosPorPanel(): string[] {
  return [
    ...CONTROLADOS_GENERICOS, ...CONTROLADOS_MENU_SECCION, ...CONTROLADOS_PALETA_SECCION,
    ...CONTROLADOS_TIENDA_PAGINAS, ...CONTROLADOS_ENCABEZADO_SECCION,
  ].sort();
}

// ─── LADO C: la ÚNICA lista a mano — PENDIENTE-PANEL, decreciente ─────────────────────────────────

export interface ExencionPendiente {
  /** La ruta exacta del campo, tal como la produce `camposLeidosPorTienda()`. */
  campo: string;
  /** Por qué hoy no tiene control — casi siempre "sólo `mergePresetEnContent` lo escribe". */
  razon: string;
  /** El id del slice (coined en este slice, § DECISIONS.md) que le dará su editor. */
  cierra: string;
}

// Medido contra el código real (2026-09-23), no contra lo que este slice ASUMÍA al arrancar: el spec
// citaba un puñado de huecos (las 4 metas de chrome + cromo + los dos toggles del hero + el badge del
// menú). Al derivar el chequeo de verdad aparecieron CUATRO SECCIONES ENTERAS sin ningún editor
// (`marquesina`, `trustBadges`, `origen`, `spotlight` — ninguna estaba en `SECCIONES_TIENDA` a esa
// fecha; `spotlight` ganó su PIN por `PANEL-EDITOR-SPOTLIGHT-PIN-1`, sus otros cuatro campos siguen
// sin editor; `origen` ganó su `SeccionConfig` COMPLETA por `PANEL-EDITOR-ORIGEN-1` — ninguna entrada
// suya queda en `PENDIENTE_PANEL` — § PENDIENTE_PANEL abajo; esta frase queda como medición histórica,
// no re-medida), el eje
// `variante`/`escalares` completo (ninguna de las 4 secciones que lo declaran tiene control alguno del
// lado del panel — ni siquiera `TiendaSeccionEditor` sabe leer `config.variantes`), y DOS campos
// declarados en `REGISTRY.<seccion>.campos` pero ausentes del `config` que el editor real usa —
// `hero.imagenPoster` (ausente de `HERO.imagenes`) y `hero.fraseAlPie` (ausente de `HERO.campos`,
// pese a que su propio docstring en site-content-defaults.ts dice "es un `campos` normal, abajo") —
// el mismo patrón de "declarado en un lado, no en el otro" que ya mordió en C1/§65-B. Esto es una
// DESVIACIÓN medida del spec, no un error de éste: el chequeo se construyó para medir la realidad, y
// la realidad es más grande que la estimación. Se declara acá, completa — no se recorta para calzar
// con lo esperado.
export const PENDIENTE_PANEL: ExencionPendiente[] = [
  // El hero-video (§ HERO-VIDEO-COMO-DATO-1): sin editor, hoy no se puede subir un hero de video desde
  // el panel en absoluto — `imagenTipo` y `imagenPoster` existen en el modelo y el schema, no en la UI.
  { campo: 'hero.imagenTipo', razon: 'Sólo mergePresetEnContent lo escribe; sin control en tienda-secciones.ts', cierra: 'PANEL-EDITOR-HERO-VIDEO-1' },
  { campo: 'hero.imagenPoster', razon: 'Declarado en REGISTRY.hero.campos/imagenes; ausente de HERO.imagenes en tienda-secciones.ts', cierra: 'PANEL-EDITOR-HERO-VIDEO-1' },

  // `fraseAlPie` (§ TEMAS-HERO-MEDIA-AGREGADOS-1): declarado en REGISTRY.hero.campos como 'opcional'
  // (su propio docstring dice "es un `campos` normal, abajo") pero ausente de HERO.campos en
  // tienda-secciones.ts — el `.hero-caption` del prototipo no tiene por dónde escribirse hoy.
  { campo: 'hero.fraseAlPie', razon: 'Declarado en REGISTRY.hero.campos como campo normal; ausente de HERO.campos en tienda-secciones.ts', cierra: 'PANEL-EDITOR-HERO-FRASE-AL-PIE-1' },

  // El eje `variante` (composición de sección, § eje 5/5e): las CUATRO secciones que lo declaran no
  // tienen ningún control — ni `TiendaSeccionEditor` sabe leer `config.variantes` hoy.
  { campo: 'hero.variante', razon: 'Sólo mergePresetEnContent lo escribe; TiendaSeccionEditor no renderiza `variante`', cierra: 'PANEL-EDITOR-VARIANTES-COMPOSICION-1' },
  { campo: 'brandStory.variante', razon: 'Sólo mergePresetEnContent lo escribe; TiendaSeccionEditor no renderiza `variante`', cierra: 'PANEL-EDITOR-VARIANTES-COMPOSICION-1' },
  { campo: 'presentaciones.variante', razon: 'Sólo mergePresetEnContent lo escribe; TiendaSeccionEditor no renderiza `variante`', cierra: 'PANEL-EDITOR-VARIANTES-COMPOSICION-1' },
  { campo: 'subscriptionCTA.variante', razon: 'Sólo mergePresetEnContent lo escribe; TiendaSeccionEditor no renderiza `variante`', cierra: 'PANEL-EDITOR-VARIANTES-COMPOSICION-1' },

  // La banda MARQUESINA (§ MARQUESINA-BANDA-1): sección completa en REGISTRY, ausente de SECCIONES_TIENDA.
  { campo: 'marquesina.visible', razon: 'Sección entera ausente de SECCIONES_TIENDA — sin editor', cierra: 'PANEL-EDITOR-MARQUESINA-1' },
  { campo: 'marquesina.texto', razon: 'Sección entera ausente de SECCIONES_TIENDA — sin editor', cierra: 'PANEL-EDITOR-MARQUESINA-1' },
  { campo: 'marquesina.imagen', razon: 'Sección entera ausente de SECCIONES_TIENDA — sin editor', cierra: 'PANEL-EDITOR-MARQUESINA-1' },
  { campo: 'marquesina.productoSlug', razon: 'Sección entera ausente de SECCIONES_TIENDA — sin editor', cierra: 'PANEL-EDITOR-MARQUESINA-1' },

  // TRUST BADGES (§ CORTE-TRUSTBADGES-OCULTABLE-1): su ÚNICO campo (`campos: {}` en REGISTRY) es el
  // interruptor, y ni ése tiene control — PaletaSeccion monta el componente para PREVIEW, no lo edita.
  { campo: 'trustBadges.visible', razon: 'Sección entera ausente de SECCIONES_TIENDA — PaletaSeccion sólo la monta para vista previa, no la edita', cierra: 'PANEL-EDITOR-TRUSTBADGES-VISIBLE-1' },

  // CERRADO por PANEL-EDITOR-ORIGEN-1: `origen` ganó su `SeccionConfig` (ORIGEN en tienda-secciones.ts,
  // con las 19 entradas de campos + el toggle `visible`) — las veinte entradas de exención de esta
  // sección se retiraron de acá.

  // La banda SPOTLIGHT (§ SPOTLIGHT-BANDA-1). CERRADO PARCIAL por PANEL-EDITOR-SPOTLIGHT-PIN-1: el
  // PIN (`productoSlug`/`otroTamanoSlug`) ya tiene control (`SPOTLIGHT` en `SECCIONES_TIENDA`, §
  // `CONTROLADOS_GENERICOS`) — sus dos entradas se retiraron de acá. Los otros CUATRO campos
  // (`visible`/`eyebrow`/`titulo`/`badge`) siguen SIN editor — alcance explícito del owner para ese
  // slice ("Pin del spotlight", "solo esos") — y su `cierra` se re-apunta de `PANEL-EDITOR-
  // SPOTLIGHT-1` a `PANEL-EDITOR-SPOTLIGHT-RESTO-1` (coined por ese slice) para que no quede
  // apuntando a un id que no los va a cerrar.
  { campo: 'spotlight.visible', razon: 'Sección sin toggle en el editor (SPOTLIGHT.ocultable:false a propósito) — fuera del alcance "sólo el pin"', cierra: 'PANEL-EDITOR-SPOTLIGHT-RESTO-1' },
  { campo: 'spotlight.eyebrow', razon: 'Fuera del alcance "sólo el pin" de PANEL-EDITOR-SPOTLIGHT-PIN-1 — sin editor', cierra: 'PANEL-EDITOR-SPOTLIGHT-RESTO-1' },
  { campo: 'spotlight.titulo', razon: 'Fuera del alcance "sólo el pin" de PANEL-EDITOR-SPOTLIGHT-PIN-1 — sin editor', cierra: 'PANEL-EDITOR-SPOTLIGHT-RESTO-1' },
  { campo: 'spotlight.badge', razon: 'Fuera del alcance "sólo el pin" de PANEL-EDITOR-SPOTLIGHT-PIN-1 — sin editor', cierra: 'PANEL-EDITOR-SPOTLIGHT-RESTO-1' },

  // CERRADO por PANEL-EDITOR-MENU-BADGE-1: `menu.badgeItem`/`badgeTexto` (§ CORTE-BADGE-COSECHA-EN-
  // MENU-1) ya tienen control en `MenuSeccion.tsx` (§ CONTROLADOS_MENU_SECCION, arriba) — sus dos
  // entradas de exención se retiraron de acá.

  // Los DOS ejes aditivos de tema + la escala de display (§ TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1,
  // TEMAS-ESCALA-DISPLAY-1) — ya documentado en el propio `TemaContent`: "NINGÚN escritor real los
  // pone hoy... sólo mergePresetEnContent".
  { campo: 'tema.origenTexto', razon: 'Sólo mergePresetEnContent lo escribe; sin campo en paletaEditableSchema ni en PaletaSeccion', cierra: 'PANEL-EDITOR-TEMA-EJES-1' },
  { campo: 'tema.origenAccion', razon: 'Sólo mergePresetEnContent lo escribe; sin campo en paletaEditableSchema ni en PaletaSeccion', cierra: 'PANEL-EDITOR-TEMA-EJES-1' },
  { campo: 'tema.escalaDisplay', razon: 'Sólo mergePresetEnContent lo escribe; sin campo en paletaEditableSchema ni en PaletaSeccion', cierra: 'PANEL-EDITOR-TEMA-EJES-1' },

  // CROMO (§ CROMO-NAV-FOOTER-TEMATIZABLE-1): `navTinta`/`navSubtitulo` ya tienen control
  // (`EncabezadoSeccion.tsx`, § PANEL-EDITOR-ENCABEZADO-1 — cierra su entrada acá). `navBadge` sigue
  // DORMIDO — el badge de cosecha se mudó al ítem de menú (§ CORTE-BADGE-COSECHA-EN-MENU-1) y su
  // control real, `menu.badgeItem`/`badgeTexto`, YA ESTÁ CONTROLADO (§ PANEL-EDITOR-MENU-BADGE-1,
  // CONTROLADOS_MENU_SECCION arriba — ese slice cerró SU par de exenciones, no ésta). `cromo.navBadge`
  // no va a tener su PROPIO editor: queda como campo sin escritor del panel, reenviado tal cual por
  // `EncabezadoSeccion` para no perderlo en cada guardado (§ el docstring de ese componente). Su
  // salida es RETIRARLO del modelo —ya no lo lee ningún render (§ `itemsDeMenu` reemplazó su único
  // consumidor)—, no darle un editor propio; `cierra` apunta a ese retiro, coined por este slice.
  { campo: 'cromo.navBadge', razon: 'Dormido: su único consumidor real (el badge del nav) lo reemplazó menu.badgeItem/badgeTexto, ya controlado; cromo.navBadge queda sin editor propio, sólo reenviado por EncabezadoSeccion.tsx', cierra: 'CROMO-NAVBADGE-RETIRO-1' },

  // Las DOS metas de chrome que NO entran en este slice (§ PANEL-EDITOR-ENCABEZADO-1, "LOS QUE NO
  // VAN": son "Detalles del sitio", otro slice). `navTratamiento.activo`/`navWordmark.activo` ya
  // tienen control (`EncabezadoSeccion.tsx` — cierran acá, salieron de este grupo).
  { campo: 'volverArriba.visible', razon: 'Sólo mergePresetEnContent lo escribe; sin control en el panel', cierra: 'PANEL-EDITOR-CHROME-METAS-1' },
  { campo: 'rielSocial.visible', razon: 'Sólo mergePresetEnContent lo escribe; sin control en el panel', cierra: 'PANEL-EDITOR-CHROME-METAS-1' },
];

// ─── EL CHEQUEO ─────────────────────────────────────────────────────────────────────────────────────

/** El núcleo PURO del chequeo: campos leídos que ni están controlados ni exentos. Separado de
 *  `huecosDelPanel` (abajo, que usa los datos REALES) para poder probarlo con datos SINTÉTICOS —
 *  la única forma de ver, en un test, que el mecanismo FALLA cuando nace un campo sin panel: no hay
 *  forma de "agregar un campo nuevo" a REGISTRY dentro de un test sin tocar el archivo real. */
export function camposFaltantes(leidos: string[], controlados: string[], exentos: string[] = []): string[] {
  const c = new Set(controlados);
  const e = new Set(exentos);
  return leidos.filter((campo) => !c.has(campo) && !e.has(campo));
}

/** El chequeo real. `conExenciones: true` (default) es el GATE — debe dar `[]`. `conExenciones: false`
 *  es la CALIBRACIÓN (§ el reporte de este slice): lista TODO hueco de hoy, exento o no, para verificar
 *  que el chequeo de verdad los atrapa a todos cuando nadie los declara pendientes. */
export function huecosDelPanel(opts: { conExenciones?: boolean } = {}): string[] {
  const conExenciones = opts.conExenciones ?? true;
  const leidos = camposLeidosPorTienda();
  const controlados = camposControladosPorPanel();
  const exentos = conExenciones ? PENDIENTE_PANEL.map((e) => e.campo) : [];
  return camposFaltantes(leidos, controlados, exentos);
}
