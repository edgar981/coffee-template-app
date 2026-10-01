// lib/storefront/pdp-botones.ts — § PARIDAD-PDP-BOTONES-1
//
// EL DEFECTO (CENSO-PARIDAD-MUESTRARIO-1): en `/tienda/[slug]` los dos botones de compra estaban
// AL REVÉS respecto del prototipo (`docs/prototipos/cafeone/producto.html:197-201`,
// `css/app.css:123-142`) — "Agregar al carrito" salía sólido en `--sf-tinta` (un verde-tinta ajeno al
// resto del storefront, que en CORTE ni siquiera es un tono cálido) y "Comprar ahora" salía en
// contorno. El prototipo hace lo opuesto: `.btn--primary` (sólido, acento) es "Comprar ahora";
// `.btn--secondary` (contorno de acento que se llena al hover) es "Agregar al carrito".
//
// EL MECANISMO — NO se agrega ningún campo de `SiteContent` nuevo. `tema.origenAccion` (§ TEMAS-
// ROLES-DECLARADOS-POR-EL-PRESET-1, `palette-derive.ts`) YA declara, por preset, "de qué raíz nace la
// ACCIÓN PRIMARIA" — exactamente la pregunta que decide si el acento de un tema se comporta como el
// `--action-primary` de un botón (CORTE, un rojo de acción puro) o como el tostado cálido de siempre
// (Nayoli y todo tenant sin este eje). Es el eje MÁS CERCANO ya existente al problema — más cercano
// que `tema.forma` (que también distingue CORTE, pero es una FORMA compartida con PLIEGO — § el
// caso ya escrito del trazo de íconos en `StoreNav.tsx`/`formas.ts`, donde bumpear `forma` habría
// afectado a un preset ajeno; usar `forma` acá arrastraría el mismo riesgo el día que PLIEGO también
// pida `forma:'recta'` sin compartir la jerarquía de botones de CORTE) — así que reusarlo es SEGUIR
// la doctrina en vez de fundar una excepción: `origenAccion` sólo lo declara CORTE hoy, y seguirá
// siendo así hasta que un preset futuro comparta el mismo hecho de fondo (un acento que ES color de
// acción, no un tono cálido de botón) — en cuyo caso también debería heredar esta jerarquía, que es
// justo lo que este gate hace automáticamente.
//
// `origenAccion` YA es un campo de `PresetTema`/`TemaContent`, YA resuelto por `resolverTema` y
// expuesto en `useSiteContent().tema.origenAccion`, y YA está exento en `PENDIENTE_PANEL`
// (`panel-controles.ts`: "tema.origenAccion… Sólo mergePresetEnContent lo escribe") — reusarlo no
// suma NINGÚN campo nuevo a `site-content-schema.ts`/`site-content-defaults.ts`/`panel-controles.ts`,
// así que ninguno de los tres necesitó tocarse para esta reescritura (quedan en `touches:` como techo
// del slice, no como trabajo obligatorio).
//
// PURO, sin DOM: lo afirmable es la DECISIÓN (qué clases corresponden a cada eje), no el render.

/** El eje que gobierna esta decisión — el mismo tipo que `TemaContent.origenAccion`
 *  (`lib/config/palette-derive.ts`, `OrigenAccion`), pero re-declarado LOCAL para no importar el
 *  módulo de paleta desde un archivo cuyo único consumo es un string literal: menos superficie de
 *  import, mismo contrato (`'acento' | 'tostado' | null`, y `resolverTema` nunca guarda otra cosa). */
export type OrigenAccionBotones = 'acento' | 'tostado' | null;

export interface ClasesBotonesCompra {
  /** "Comprar ahora" — la acción PRIMARIA. */
  primario: string;
  /** "Agregar al carrito" — la acción SECUNDARIA. */
  secundario: string;
  /** El CONTENEDOR del selector de cantidad ("−  1  +") — § DESTACADO-PANEL-COMPLETO-Y-BOTONES-
   *  PDP-1. Nuevo en este slice: antes vivía hardcodeado en `page.tsx` para TODOS los presets, con
   *  un alto DISTINTO del de `secundario` (§ el docstring de `CANTIDAD_CORTE`, abajo). */
  cantidad: string;
  /** Cada botón "−"/"+" DENTRO del selector de cantidad. */
  cantidadBoton: string;
}

// BYTE-IDÉNTICO a lo que el JSX traía antes de este slice (Nayoli y todo tenant sin `origenAccion`):
// "Comprar ahora" en contorno de acento, "Agregar al carrito" sólido en tinta. NO se toca un carácter.
const PRIMARIO_DEFECTO =
  'w-full border-2 border-[var(--sf-acento)] text-[var(--sf-acento-texto)] hover:bg-[var(--sf-acento)] hover:text-[var(--sf-acento-txt)] font-semibold py-4 rounded-2xl transition-all text-sm';
const SECUNDARIO_DEFECTO =
  'flex-1 flex items-center justify-center gap-2 bg-[var(--sf-tinta)] hover:bg-[var(--sf-tinta-2)] text-[var(--sf-sobre)] font-semibold py-4 rounded-2xl transition-all hover:-translate-y-0.5 text-sm';
// CANTIDAD/FAVORITOS (§ DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1) — BYTE-IDÉNTICO a lo que el JSX
// de `/tienda/[slug]` traía ANTES de este slice (las mismas clases que vivían inline en `page.tsx`,
// ahora sólo EXTRAÍDAS, no editadas): el contenedor de cantidad en superficie rellena sin borde, los
// botones −/+ a `w-9 h-9`, y el corazón de favoritos `w-12 h-12` con sus dos estados de color
// hardcodeados (no hay eje de tema que los toque hoy).
const CANTIDAD_DEFECTO = 'flex items-center gap-2 bg-[var(--sf-superficie)] rounded-xl px-1';
const CANTIDAD_BOTON_DEFECTO =
  'w-9 h-9 flex items-center justify-center hover:bg-[var(--sf-linea)] sf-radio-lg transition-colors cursor-pointer';

// CORTE (`origenAccion:'acento'`) — MISMO tratamiento `.btn--primary`/`.btn--secondary` ya vetado
// contra el prototipo en `Spotlight.tsx:361` (el "Agregar al carrito" de la banda spotlight) y
// `StoreNav.tsx:712` (el CTA "Comprar" del encabezado, § CROMO-NAV-CTA-Y-BADGE-1): `sf-pildora`
// para el radio (0 bajo `forma:'recta'` de CORTE), `sf-borde` para el grosor del borde del contorno,
// mayúscula + tracking .085em + semibold, `py-[18px] px-[28px]` (`--button-pad-y`/`-x`), hover/active
// vía `--sf-accion-hover`/`--sf-accion-active` (§ CTA-HOVER-RESTO-FAMILIA-1, `palette-derive.ts`) —
// ningún valor de esta lista es inventado para este slice, todos ya circulan en el storefront bajo
// el mismo eje.
//
// `--sf-accion-hover`/`--sf-accion-active` son `oscurecer(acento, factor)` en OKLCH (preserva el
// HUE) — NO `mezclar(acento, tinta, w)`, el mecanismo VIEJO (`--sf-acento-3`/`-2`) que este mismo
// archivo usaba hasta `§ CTA-HOVER-RESTO-FAMILIA-1`: MEDIDO contra CORTE, mezclar hacia la tinta
// (verde) desviaba el hue del rojo a un marrón/oliva (`acento-3`→`#672d00`, `acento-2`→`#403000`) —
// el defecto que el gate del owner reportó ("cambiarlo a ese otro tono", no "el mismo rojo
// oscurecido"). `PARIDAD-PDP-BOTONES-1` había medido y aceptado esa aproximación como fuera de su
// alcance; `§ CTA-HOVER-RESTO-FAMILIA-1` la cierra.
//
// `.btn--secondary` del prototipo (`css/app.css:137-142`) rellena a `--action-primary` (el acento
// CRUDO, no el matiz `-hover`) al pasar el mouse, y a `--action-primary-active` (el matiz `-active`,
// más oscuro) al presionar — por eso el hover de acá usa `--sf-acento` (no `-3` ni `--sf-accion-
// hover`: el prototipo mismo no distingue un tono de hover para el secundario) y el active usa
// `--sf-accion-active`, la MISMA que usa el primario para su propio active.
//
// EL BORDE/TEXTO DEL SECUNDARIO USA `--sf-acento` (crudo), NUNCA `--sf-acento-texto` — MEDIDO, no
// asumido, contra el muestrario desplegado: CORTE declara `origenTexto:'tinta'` (§ TEMAS-ROLES-
// DECLARADOS-POR-EL-PRESET-1), y ESE eje redirige `acento-texto` a nacer de la TINTA, no del acento
// —es uno de los TRES roles de "texto de lectura" que mueven con `origenTexto`—. Capturado en vivo
// contra `coffee-template-app-onix.vercel.app/tienda/…`: `--sf-acento-texto` resuelve **`#102407`**
// (= la raíz `tinta` de CORTE), NO `#a70004` (el acento). Es EXACTAMENTE el defecto que
// `CENSO-PARIDAD-MUESTRARIO-1` midió en el botón viejo ("Comprar ahora" — outline con borde ROJO
// pero TEXTO TINTA, `color: rgb(16, 36, 7)`): el código de antes YA usaba `--sf-acento-texto`
// para el texto del contorno, y por eso el borde y el texto salían de dos colores distintos. El
// prototipo NO tiene esa distinción — `--action-secondary-border` Y `--action-secondary-text` son
// el MISMO valor crudo (`#a70004`, `tokens.css:80-81`) — así que acá también van del mismo token,
// `--sf-acento`, para que borde y texto SIEMPRE coincidan sin importar qué declare `origenTexto`.
// `--sf-acento` no es uno de los roles que `origenTexto` mueve (sólo mueve `texto`/`texto-suave`/
// `acento-texto`), así que es estable ante cualquier preset futuro que declare ese eje.
const PRIMARIO_CORTE =
  'w-full flex items-center justify-center gap-2 sf-pildora bg-[var(--sf-acento)] hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))] active:bg-[var(--sf-accion-active,var(--sf-tostado-3))] active:translate-y-px text-[var(--sf-acento-txt)] font-semibold uppercase tracking-[0.085em] py-[18px] px-[28px] transition-all duration-[120ms] text-sm cursor-pointer';
const SECUNDARIO_CORTE =
  'flex-1 flex items-center justify-center gap-2 sf-pildora sf-borde border-[var(--sf-acento)] text-[var(--sf-acento)] hover:bg-[var(--sf-acento)] hover:text-[var(--sf-acento-txt)] active:bg-[var(--sf-accion-active,var(--sf-tostado-3))] active:text-[var(--sf-acento-txt)] active:translate-y-px font-semibold uppercase tracking-[0.085em] py-[18px] px-[28px] transition-all duration-[120ms] text-sm cursor-pointer';

// CANTIDAD/FAVORITOS bajo CORTE (§ DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1) — el gate del owner con
// captura (`onix-pdp-botones.png`): "en el detalle del producto estos botones se ven un poco off,
// especialmente el tamaño de 'favoritos'". MEDIDO contra el código, no contra la imagen: el defecto
// no es un número de píxeles mal elegido, es que los TRES controles (cantidad, Agregar, favoritos)
// vienen de TRES fórmulas de alto independientes —`h-9` fijo dentro de un contenedor sin padding
// vertical (cantidad, ~38px), `py-[18px]` + línea de texto (Agregar/`SECUNDARIO_CORTE`, ~58px) y
// `h-12` fijo (favoritos, 48px)— que nunca se pensaron juntas.
//
// LA REGLA, para que los tres compartan EXACTAMENTE el mismo alto sin un número mágico que haya que
// mantener sincronizado a mano: CANTIDAD toma el MISMO padding vertical que los botones de compra
// (`py-[18px]`) y dentro de él los controles "−"/"+" dejan de tener un alto PROPIO (nada de `h-9`;
// el ícono de 16px define la línea, igual que el texto de "Agregar al carrito" la define en
// `SECUNDARIO_CORTE`) — mismo padding + mismo contenido de línea = mismo alto, por construcción, no
// por coincidencia. FAVORITOS no fija NINGÚN alto propio: es un hijo `aspect-square` del MISMO flex
// row que "Agregar al carrito" (`<div className="flex gap-3">` en page.tsx, `align-items` default =
// `stretch`), así que su alto lo da el de su hermano —automáticamente igual, para siempre— y
// `aspect-square` deriva el ANCHO de ese alto: "el corazón, cuadrado del alto del botón", literal.
//
// EL BORDE Y EL COLOR SON EL MISMO TOKEN que `SECUNDARIO_CORTE` (`sf-borde border-[var(--sf-acento)]`,
// mismo hover/active `--sf-accion-hover`/`--sf-accion-active` — la "familia" que pide el spec), no
// una aproximación nueva.
const CANTIDAD_CORTE =
  'inline-flex items-center gap-4 sf-pildora sf-borde border-[var(--sf-acento)] text-[var(--sf-acento)] py-[18px] px-[22px] transition-colors duration-[120ms]';
const CANTIDAD_BOTON_CORTE =
  'flex items-center justify-center cursor-pointer hover:text-[var(--sf-accion-hover,var(--sf-tostado-4))] transition-colors duration-[120ms]';
// Base compartida por los DOS estados de favoritos (sin wishlist/con wishlist) — el color es lo
// único que cambia entre ellos, § `claseBotonFavoritos`, abajo.
const FAVORITOS_CORTE_BASE =
  'aspect-square shrink-0 flex items-center justify-center sf-pildora sf-borde transition-colors duration-[120ms] active:translate-y-px cursor-pointer';
// BYTE-IDÉNTICO al `<button>` de favoritos que `page.tsx` traía ANTES de este slice.
const FAVORITOS_DEFECTO_BASE = 'w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all';

/**
 * Las clases de los dos botones de compra de `/tienda/[slug]`, más el selector de CANTIDAD, según
 * `tema.origenAccion`. Sólo `'acento'` (CORTE, hoy el único preset que lo declara) recibe el
 * tratamiento del prototipo; `null` o `'tostado'` (todo lo demás, incluida Nayoli) cae byte a byte en
 * lo que el JSX ya tenía.
 */
export function clasesBotonesCompra(origenAccion: OrigenAccionBotones): ClasesBotonesCompra {
  if (origenAccion === 'acento') {
    return { primario: PRIMARIO_CORTE, secundario: SECUNDARIO_CORTE, cantidad: CANTIDAD_CORTE, cantidadBoton: CANTIDAD_BOTON_CORTE };
  }
  return { primario: PRIMARIO_DEFECTO, secundario: SECUNDARIO_DEFECTO, cantidad: CANTIDAD_DEFECTO, cantidadBoton: CANTIDAD_BOTON_DEFECTO };
}

/**
 * Las clases del botón FAVORITOS (el corazón), según `tema.origenAccion` y si ya está en la lista de
 * deseos. Separado de `clasesBotonesCompra` porque su color depende de un SEGUNDO eje (`wishlisted`)
 * que los otros controles no tienen — una sola función con dos ejes booleanos sería menos legible
 * que dos funciones con un eje cada una.
 */
export function claseBotonFavoritos(origenAccion: OrigenAccionBotones, wishlisted: boolean): string {
  if (origenAccion === 'acento') {
    return wishlisted
      ? `${FAVORITOS_CORTE_BASE} border-[var(--sf-acento)] bg-[var(--sf-acento)] text-[var(--sf-acento-txt)]`
      : `${FAVORITOS_CORTE_BASE} border-[var(--sf-acento)] text-[var(--sf-acento)] hover:bg-[var(--sf-acento)] hover:text-[var(--sf-acento-txt)]`;
  }
  return wishlisted
    ? `${FAVORITOS_DEFECTO_BASE} border-red-400 bg-red-50 text-red-500`
    : `${FAVORITOS_DEFECTO_BASE} border-[var(--sf-linea)] text-[var(--sf-tostado-3)] hover:border-red-300`;
}
