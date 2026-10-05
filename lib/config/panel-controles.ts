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
// ya gobierna el resolver. Más las DIEZ claves NO-sección con forma fija (`paginas`, `tema`, `cromo`,
// `volverArriba`, `rielSocial`, `carritoEnvio`, `carrito` (§ MUESTRARIO-CARRITO-COMPOSICION-1),
// `navTratamiento`, `navWordmark`, `navDrawerMovil`), leídas de `DEFAULTS` en runtime.
//
// LO QUE QUEDA AFUERA A PROPÓSITO — `esquemas`, `orden`, `variantesBandas`, `presetSnapshot`,
// `seccionesHome` (§ EDITOR-AGREGAR-SECCION-1) — NO por una lista de excepciones, sino porque NUNCA
// ENTRAN al lado "leído": son dominio ABIERTO (`esquemas`/`variantesBandas`/`presetSnapshot` son
// `Record<string, X>` sin claves fijas — cualquier bandaId (o, para `presetSnapshot`, cualquier
// ruta) puede tener entrada; `orden` es un array de reordenamiento, no un objeto con campos
// nombrados; `seccionesHome` es un `Record<string, InstanciaContent>` cuyas claves el DUEÑO crea
// al agregar una sección — ninguna lista cerrada podría enumerarlas de antemano, y sus campos
// internos los gobierna su propio catálogo, § `DESCRIPTOR_INSTANCIA`/`secciones-instancias.test.ts`,
// no este chequeo). Un chequeo por-campo no tiene NADA que enumerar ahí — no es que se decida
// omitirlos, es que la forma del dato no tiene "campos". Los primeros tres se componen en
// el onboarding (decisión del owner, ya asentada en CLAUDE.md, § el docstring de
// `EsquemasContent`/`VariantesBandasContent`/`OrdenContent` en site-content-defaults.ts), no en un
// picker del panel; `presetSnapshot` (§ REAPPLY-PRESERVA-OVERRIDES-1) NUNCA se compone a mano, en el
// onboarding ni en ningún otro lado — es CONTABILIDAD que `mergePresetEnContent` (`themes.ts`) escribe
// y lee sola, y por eso el dueño no la edita ni siquiera indirectamente.
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
import { elementosEstiloDeSeccion, ELEMENTOS_ESTILO } from './estilo-elemento';

// ─── LADO A: lo que la tienda LEE ──────────────────────────────────────────────────────────────────

/** Las DIEZ claves NO-sección con forma FIJA (un objeto con campos nombrados, no un `Record` abierto).
 *  `esquemas`/`orden`/`variantesBandas`/`seccionesHome` NO están acá — dominio abierto, § el
 *  comentario de cabecera. */
const METAS_CON_CAMPOS = ['paginas', 'tema', 'cromo', 'volverArriba', 'rielSocial', 'carritoEnvio', 'carrito', 'navTratamiento', 'navWordmark', 'navDrawerMovil'] as const;
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
  // ESTILOS POR ELEMENTO (§ EDITOR-TIENDA-BARRA-FLOTANTE-1): `def.estilos` declara los elementos de
  // texto de la sección con estilo propio — cada uno es, para este chequeo, un "campo" más,
  // granularidad `estilos.<elemento>` (no se baja a los cuatro subcampos: el control de la barra
  // flotante/del panel es POR ELEMENTO, no por subcampo suelto — mismo criterio que
  // `camposDeItemsRepeater` trata cada campo de ítem, no cada letra).
  for (const el of def.estilos ?? []) campos.add(`estilos.${el}`);
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
 *  no estaba anticipada al diseñar la derivación.
 *
 *  UN CAMPO con `seccionCruzada` (§ EDITOR-TIENDA-MARQUESINA-EN-HERO-1, `CampoTexto.seccionCruzada`)
 *  se atribuye a SU SECCIÓN REAL (`${c.seccionCruzada}.${c.name}`), no a la que lo declara en el
 *  editor: `HERO.campos` declara `texto`/`productoSlug` para mostrarlos dentro de la tarjeta del
 *  hero, pero lo que la tienda LEE (lado A, `camposLeidosPorTienda`) sigue siendo
 *  `marquesina.texto`/`marquesina.productoSlug` — atribuirlos a `hero.*` dejaría esos dos campos
 *  reales SIN control (huecos falsos) y agregaría dos claves fantasma (`hero.texto`/
 *  `hero.productoSlug`) que `REGISTRY.hero` no tiene. */
function camposDeSeccionEditor(config: SeccionConfig): string[] {
  const s = config.seccion;
  const campos = new Set<string>();
  const cruzados = new Set<string>();
  for (const c of config.campos) {
    if (c.seccionCruzada) cruzados.add(`${c.seccionCruzada}.${c.name}`);
    else campos.add(c.name);
  }
  for (const im of config.imagenes) campos.add(im.name);
  if (config.ocultable) campos.add('visible');
  for (const b of config.booleanos ?? []) campos.add(b.name);
  // § EDITOR-TIENDA-COMPOSICION-1: `config.composiciones` declara la vista «¿Cómo se arma tu
  // <sección>?» que escribe el escalar `variante` — mismo criterio que `visible`/`booleanos`
  // arriba, presencia de la config ⇒ `variante` entra al lado controlado.
  if (config.composiciones) campos.add('variante');
  for (const bloque of config.bloques ?? []) {
    if (bloque.tipo === 'lista') for (const slot of bloque.slots) campos.add(slot);
  }
  const planos = [...campos].sort().map((c) => `${s}.${c}`);
  const items = config.repeater ? [...config.repeater.campos].map((c) => `${s}.items.${c.name}`).sort() : [];
  return [...planos, ...[...cruzados].sort(), ...items];
}

/** Lo que las DIEZ secciones de `SECCIONES_TIENDA` cubren, vía el editor genérico. */
const CONTROLADOS_GENERICOS: string[] = SECCIONES_TIENDA.flatMap(camposDeSeccionEditor);

/** DECLARACIÓN EXPLÍCITA de lo que `MenuSeccion.tsx` controla (`menu` NO pasa por `TiendaSeccionEditor`,
 *  § CROMO-MENU-PANEL-EDITOR-1) — leído de su código: las tres etiquetas (`labelTienda`,
 *  `labelSuscripciones`, `labelNosotros`), las tres posiciones de orden, el CTA (`ctaLabel`,
 *  `ctaDestino`), el BADGE (`badgeItem`, `badgeTexto` — § PANEL-EDITOR-MENU-BADGE-1: el select del
 *  ítem con badge + su texto, con `badgeTexto` atenuado sin ítem elegido), y el PANEL DESPLEGABLE
 *  (§ MUESTRARIO-MEGA-MENU-1: el select del ítem con panel + sus 27 campos —intro/CTA, las dos
 *  columnas de hasta 3 enlaces, la tarjeta—, atenuados sin ítem elegido, mismo tratamiento que el
 *  badge). `menu.visible` no aplica — `REGISTRY.menu.ocultable` es `false`, así que no entra al lado
 *  "leído" (§ arriba). */
const CONTROLADOS_MENU_SECCION = [
  'menu.labelTienda', 'menu.labelSuscripciones', 'menu.labelNosotros',
  'menu.posicion1', 'menu.posicion2', 'menu.posicion3',
  'menu.ctaLabel', 'menu.ctaDestino',
  'menu.badgeItem', 'menu.badgeTexto',
  'menu.panelItem',
  'menu.panelIntro', 'menu.panelIntroCtaLabel', 'menu.panelIntroCtaDestino',
  'menu.panelCol1Titulo',
  'menu.panelCol1Link1Etiqueta', 'menu.panelCol1Link1Nota', 'menu.panelCol1Link1Destino',
  'menu.panelCol1Link2Etiqueta', 'menu.panelCol1Link2Nota', 'menu.panelCol1Link2Destino',
  'menu.panelCol1Link3Etiqueta', 'menu.panelCol1Link3Nota', 'menu.panelCol1Link3Destino',
  'menu.panelCol2Titulo',
  'menu.panelCol2Link1Etiqueta', 'menu.panelCol2Link1Nota', 'menu.panelCol2Link1Destino',
  'menu.panelCol2Link2Etiqueta', 'menu.panelCol2Link2Nota', 'menu.panelCol2Link2Destino',
  'menu.panelCol2Link3Etiqueta', 'menu.panelCol2Link3Nota', 'menu.panelCol2Link3Destino',
  'menu.panelTarjetaImagen', 'menu.panelTarjetaTitulo', 'menu.panelTarjetaCtaLabel', 'menu.panelTarjetaCtaDestino',
];

/** DECLARACIÓN EXPLÍCITA de lo que `FooterSeccion.tsx` controla (`footer` NO pasa por
 *  `TiendaSeccionEditor`, MISMO precedente que `menu` — § CROMO-MENU-PANEL-EDITOR-1: el pipeline
 *  genérico de vista previa en vivo (`VistaTiendaEnVivo`) monta cada sección en un
 *  `Record<SeccionVista, ComponentType>` EXHAUSTIVO, y `StoreFooter` importa `useSiteSettings()`
 *  del storefront, que LANZA fuera de su árbol de providers — igual que `StoreNav` con `menu`. Un
 *  editor BESPOKE, patrón `MenuSeccion`/`PaletaSeccion`, evita tocar `VistaTiendaEnVivo.tsx`) —
 *  leído de su código: los tres encabezados de columna, las cinco etiquetas de enlace y la
 *  variante de composición, más los dos campos del ítem del repeater de la fila legal, y —
 *  desde § MUESTRARIO-FOOTER-TARJETA-IMAGEN-1, controlados DE ENTRADA, en el mismo commit que
 *  los suma a `REGISTRY.footer.campos`/`.imagenes` — la tarjeta de imagen opcional
 *  (`tarjetaImagen`/`tarjetaTexto`). `footer.visible` no aplica — `REGISTRY.footer.ocultable`
 *  es `false` (§ arriba). § PIE-HECHO-POR-DUNA-1 suma `footer.creditoDunaVisible` — el
 *  interruptor "Mostrar 'Hecho por Duna'", controlado DE ENTRADA en el mismo commit que lo suma
 *  a `REGISTRY.footer.booleanos`, mismo patrón que la tarjeta de imagen. */
const CONTROLADOS_FOOTER_SECCION = [
  'footer.columnaTienda', 'footer.columnaAyuda', 'footer.columnaEmpresa',
  'footer.linkTienda', 'footer.linkSuscripciones', 'footer.linkRastrearPedido',
  'footer.linkPreguntasFrecuentes', 'footer.linkNuestraHistoria',
  'footer.tarjetaImagen', 'footer.tarjetaTexto',
  'footer.variante', 'footer.creditoDunaVisible',
  'footer.items.label', 'footer.items.href',
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

/** DECLARACIÓN EXPLÍCITA de lo que `EncabezadoSeccion.tsx` controla (§ PANEL-EDITOR-ENCABEZADO-1,
 *  ampliado por § MUESTRARIO-DRAWER-MOVIL-TEMA-1, § CROMO-NAV-DIRECCION-SCROLL-1, §
 *  CROMO-NAV-FILETE-1, § CROMO-NAV-CTA-Y-BADGE-1, § CROMO-NAV-POSICION-TEMA-REAL-1, §
 *  CROMO-NAV-EXACTO-PROTOTIPO-1, § RIEL-SCROLL-Y-BADGE-DORADO-1, § MARCA-LOGO-IMAGEN-1 y §
 *  NAV-MOVIL-SIN-BUSCAR-1): `cromo`/`navWordmark`/`navTratamiento`/`navDrawerMovil` NO son
 *  secciones del REGISTRY (§ el docstring de `CONTROLADOS_PALETA_SECCION`, misma familia que
 *  `tema`), así que tienen su propia ruta de publicar/descartar (`/api/site-content/encabezado`) y
 *  se declaran acá, leídas de su código: los DOCE switches — logo-estilo (`navWordmark.activo`, el
 *  TRATAMIENTO del wordmark en texto, no la imagen subida — ver abajo), sub-encabezado
 *  (`cromo.navSubtitulo`), color del nav (`cromo.navTinta`), tratamiento del nav
 *  (`navTratamiento.activo`), el drawer móvil de pantalla completa (`navDrawerMovil.variante`, un
 *  switch ON/OFF sobre el set cerrado de 2 — "pantallaCompleta" vs. el default "dropdown"), el
 *  comportamiento por dirección de scroll (`navTratamiento.direccion`, §
 *  CROMO-NAV-DIRECCION-SCROLL-1), el filete inferior del encabezado (`navTratamiento.filete`, §
 *  CROMO-NAV-FILETE-1), la forma/color del CTA COMPRAR + el badge de menú (`navTratamiento.cta`, §
 *  CROMO-NAV-CTA-Y-BADGE-1), la geometría del contenedor de contenido (`navTratamiento.posicion`,
 *  § CROMO-NAV-POSICION-TEMA-REAL-1, reescrita por § CROMO-NAV-EXACTO-PROTOTIPO-1), el subrayado al
 *  hover de los links (`navTratamiento.subrayado`, § CROMO-NAV-EXACTO-PROTOTIPO-1), el hex del
 *  fondo del badge fijo (`navTratamiento.badgeColor`, § RIEL-SCROLL-Y-BADGE-DORADO-1) y el buscar
 *  de la barra en el teléfono (`navTratamiento.buscarMovil`, § NAV-MOVIL-SIN-BUSCAR-1, anidado bajo
 *  el switch de `navDrawerMovil.variante` — sólo tiene efecto bajo `'pantallaCompleta'`) — los
 *  últimos SIETE son CAMPOS de la MISMA meta que `navTratamiento.activo`, no metas nuevas, así que
 *  nacen CONTROLADOS en su propio commit: nunca pasan por `PENDIENTE_PANEL`. NO controla
 *  `cromo.navBadge` (§ PENDIENTE_PANEL, abajo — superseded por el badge del ítem de menú, que sí
 *  tiene control en `MenuSeccion.tsx`).
 *
 *  `logo.oscuro`/`logo.claro`/`logo.alt`/`logo.icono`/`logo.modo` (§ MARCA-LOGO-IMAGEN-1, + `icono`
 *  de § METADATA-ICONOS-Y-LANG-POR-TIENDA-1, + `modo` de § NAV-LOGO-Y-NOMBRE-1) SÍ son una SECCIÓN
 *  de verdad del REGISTRY (§ `REGISTRY.logo`, site-content-defaults.ts — mismo precedente que
 *  `menu`/`footer`), no una meta excluida como las cuatro de arriba, así que `camposDeSeccion('logo')`
 *  ya las deriva SOLA en `camposLeidosPorTienda()` (lado A) — esta entrada es sólo el lado B (lo
 *  controlado): la imagen de logo, el ícono de pestaña y el modo de presentación viajan en el MISMO
 *  borrador/publish que los once switches de arriba (misma UX, mismo botón "Publicar"), así que su
 *  editor es ESTE componente y no uno aparte. */
const CONTROLADOS_ENCABEZADO_SECCION = ['navWordmark.activo', 'cromo.navSubtitulo', 'cromo.navTinta', 'navTratamiento.activo', 'navTratamiento.direccion', 'navTratamiento.filete', 'navTratamiento.cta', 'navTratamiento.posicion', 'navTratamiento.subrayado', 'navTratamiento.badgeColor', 'navTratamiento.buscarMovil', 'navDrawerMovil.variante', 'logo.oscuro', 'logo.claro', 'logo.alt', 'logo.icono', 'logo.modo'];

/** DECLARACIÓN EXPLÍCITA de lo que `DetallesSitioSeccion.tsx` controla (§ PANEL-DETALLES-SITIO-1,
 *  ampliado por § MUESTRARIO-CARRITO-BARRA-ENVIO-1 y § MUESTRARIO-CARRITO-COMPOSICION-1):
 *  `volverArriba`/`rielSocial`/`carritoEnvio`/`carrito` NO son secciones del REGISTRY (§ el
 *  docstring de `CONTROLADOS_ENCABEZADO_SECCION`, misma familia), así que tienen su propia ruta de
 *  publicar/descartar (`/api/site-content/detalles`) y se declaran acá, leídas de su código: los
 *  CUATRO switches — el botón "volver arriba" (`volverArriba.visible`), el riel social
 *  (`rielSocial.visible`), la barra de progreso de envío gratis del carrito (`carritoEnvio.visible`)
 *  y la composición flotante del cajón del carrito (`carrito.variante`, un switch ON/OFF sobre el
 *  set cerrado de 2 — "flotante" vs. el default "anclado", MISMO patrón que
 *  `navDrawerMovil.variante` en `CONTROLADOS_ENCABEZADO_SECCION`). Cerró las dos últimas entradas
 *  del grupo `PANEL-EDITOR-CHROME-METAS-1` en `PENDIENTE_PANEL`; `carritoEnvio`/`carrito` nacen CON
 *  control (nunca pasaron por `PENDIENTE_PANEL`), así que no cierran ninguna entrada — sólo suman
 *  claves a esta declaración. */
const CONTROLADOS_DETALLES_SECCION = ['volverArriba.visible', 'rielSocial.visible', 'carritoEnvio.visible', 'carrito.variante'];

/** DECLARACIÓN EXPLÍCITA de lo que la barra flotante + su control gemelo del panel
 *  (`components/admin/editor/EstiloElementoControles.tsx`, montado DENTRO de `TiendaSeccionEditor.
 *  tsx` bajo cada campo estilizable —incluido un campo CRUZADO, § `renderCampoCruzado`— NO vía
 *  `SeccionConfig`/`camposDeSeccionEditor`, porque ese control se deriva de `ELEMENTOS_ESTILO`
 *  directo y no de un dato declarativo de `tienda-secciones.ts`, § EDITOR-TIENDA-BARRA-FLOTANTE-1)
 *  controlan: TODAS las secciones con entrada en `ELEMENTOS_ESTILO` (estilo-elemento.ts) — hoy
 *  `hero` (los CINCO de siempre) y `marquesina` (`texto`, § EDITOR-TIENDA-ESTILO-MARQUESINA-
 *  TICKER-1) —, derivadas de `Object.keys(ELEMENTOS_ESTILO)` + `elementosEstiloDeSeccion`, la MISMA
 *  fuente que ya alimenta `REGISTRY.<seccion>.estilos` — nunca una lista a mano que pudiera
 *  divergir. Antes de este slice sólo existía `hero`, así que iterar sobre las claves reales de
 *  `ELEMENTOS_ESTILO` en vez de nombrar 'hero' a mano es lo que evita que la TERCERA sección que
 *  gane un elemento estilizable necesite tocar este archivo para no quedar "leída y sin control". */
const CONTROLADOS_ESTILO_ELEMENTO: string[] = Object.keys(ELEMENTOS_ESTILO).flatMap(
  (seccion) => elementosEstiloDeSeccion(seccion).map((el) => `${seccion}.estilos.${el}`),
);

/** TODO campo de contenido con control en el panel HOY. */
export function camposControladosPorPanel(): string[] {
  return [
    ...CONTROLADOS_GENERICOS, ...CONTROLADOS_MENU_SECCION, ...CONTROLADOS_FOOTER_SECCION,
    ...CONTROLADOS_PALETA_SECCION, ...CONTROLADOS_TIENDA_PAGINAS, ...CONTROLADOS_ENCABEZADO_SECCION,
    ...CONTROLADOS_DETALLES_SECCION, ...CONTROLADOS_ESTILO_ELEMENTO,
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

  // CERRADO por HERO-FRASE-AL-PIE-Y-PREVIEW-1: `fraseAlPie` ganó su control (`HERO.campos` en
  // tienda-secciones.ts, campo de texto opcional) — su entrada de exención se retiró de acá. El
  // `.hero-caption` del prototipo ya tiene por dónde escribirse, y `HeroMediaMarquesina.tsx` (la
  // composición "sticky") ganó su lectura en el mismo slice (antes sólo `HeroMedia.tsx` la rendía).

  // CERRADO por EDITOR-TIENDA-COMPOSICION-1: `hero.variante` ganó su control (`HERO.composiciones`
  // en tienda-secciones.ts — la vista nueva «¿Cómo se arma tu hero?») — su entrada de exención se
  // retiró de acá. Las otras TRES secciones con `variante` siguen sin control; su `cierra` se
  // re-etiquetó de `PANEL-EDITOR-VARIANTES-COMPOSICION-1` (ya usado por ESTE slice, que sólo cubrió
  // el hero) a `PANEL-EDITOR-VARIANTES-COMPOSICION-2`, para que el próximo slice que las cierre no
  // cite un id que ya quedó asociado a otro trabajo.
  { campo: 'brandStory.variante', razon: 'Sólo mergePresetEnContent lo escribe; TiendaSeccionEditor no renderiza `variante`', cierra: 'PANEL-EDITOR-VARIANTES-COMPOSICION-2' },
  { campo: 'presentaciones.variante', razon: 'Sólo mergePresetEnContent lo escribe; TiendaSeccionEditor no renderiza `variante`', cierra: 'PANEL-EDITOR-VARIANTES-COMPOSICION-2' },
  { campo: 'subscriptionCTA.variante', razon: 'Sólo mergePresetEnContent lo escribe; TiendaSeccionEditor no renderiza `variante`', cierra: 'PANEL-EDITOR-VARIANTES-COMPOSICION-2' },

  // CERRADO por PANEL-EDITOR-MARQUESINA-1: `marquesina` ganó su `SeccionConfig` (MARQUESINA en
  // tienda-secciones.ts, con `texto`/`productoSlug`/`imagen` + el toggle `visible`) — las cuatro
  // entradas de exención de esta sección se retiraron de acá.

  // CERRADO por PANEL-EDITOR-TRUSTBADGES-VISIBLE-1: `trustBadges` ganó su `SeccionConfig`
  // (TRUSTBADGES en tienda-secciones.ts, sólo el toggle `visible` — las cuatro insignias siguen
  // siendo el array `BADGES` fijo del componente, `REGISTRY.trustBadges.campos` sigue en `{}`) — su
  // única entrada de exención se retiró de acá. Es el ÚLTIMO (8 de 8) de los ítems del programa "el
  // panel refleja la tienda" (orden del owner, 2026-09-24).

  // CERRADO por PANEL-EDITOR-ORIGEN-1: `origen` ganó su `SeccionConfig` (ORIGEN en tienda-secciones.ts,
  // con las 19 entradas de campos + el toggle `visible`) — las veinte entradas de exención de esta
  // sección se retiraron de acá.

  // La banda SPOTLIGHT (§ SPOTLIGHT-BANDA-1). CERRADO ENTERO por PANEL-EDITOR-SPOTLIGHT-PIN-1
  // (`productoSlug`/`otroTamanoSlug`) + PANEL-EDITOR-SPOTLIGHT-RESTO-1 (`visible`/`eyebrow`/
  // `titulo`/`badge`, ahora en `SPOTLIGHT.campos`/`.ocultable` de tienda-secciones.ts) — las seis
  // entradas de esta sección se retiraron de acá.

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

  // CERRADO por PANEL-DETALLES-SITIO-1: las DOS metas de chrome que `PANEL-EDITOR-ENCABEZADO-1` dejó
  // fuera a propósito ("son 'Detalles del sitio', fuera de este slice, con su propio disparador
  // futuro") ya tienen control (`DetallesSitioSeccion.tsx`, § CONTROLADOS_DETALLES_SECCION arriba) —
  // las dos entradas del grupo `PANEL-EDITOR-CHROME-METAS-1` se retiraron de acá.

  // `navWordmark.taglineColor` (§ NAV-LOGO-MOVIL-CON-AIRE-1): dato mínimo —el color del tagline
  // apilado del nav, 'atenuado'|'acento'— sin control en el panel todavía. A diferencia de las
  // demás entradas de esta lista, el porqué no es "sólo mergePresetEnContent lo escribe" (ningún
  // preset lo declara, § su propio docstring en `NavWordmarkContent`): es que el DISEÑO del control
  // —cómo se le ofrecen colores al dueño en el editor— es una decisión de producto pendiente, que el
  // owner aclaró explícitamente que NO es parte de este slice ("aún no sabría bien cómo sería la
  // forma de incorporar la feature"). Hoy se escribe DIRECTO (operación de datos, § el asiento de
  // este slice), no desde el panel.
  { campo: 'navWordmark.taglineColor', razon: 'tendrá control cuando se diseñe la sugerencia de colores del editor', cierra: 'EDITOR-SUGERENCIA-COLORES-1' },
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
