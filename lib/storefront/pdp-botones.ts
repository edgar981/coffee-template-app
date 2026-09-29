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
}

// BYTE-IDÉNTICO a lo que el JSX traía antes de este slice (Nayoli y todo tenant sin `origenAccion`):
// "Comprar ahora" en contorno de acento, "Agregar al carrito" sólido en tinta. NO se toca un carácter.
const PRIMARIO_DEFECTO =
  'w-full border-2 border-[var(--sf-acento)] text-[var(--sf-acento-texto)] hover:bg-[var(--sf-acento)] hover:text-[var(--sf-acento-txt)] font-semibold py-4 rounded-2xl transition-all text-sm';
const SECUNDARIO_DEFECTO =
  'flex-1 flex items-center justify-center gap-2 bg-[var(--sf-tinta)] hover:bg-[var(--sf-tinta-2)] text-[var(--sf-sobre)] font-semibold py-4 rounded-2xl transition-all hover:-translate-y-0.5 text-sm';

// CORTE (`origenAccion:'acento'`) — MISMO tratamiento `.btn--primary`/`.btn--secondary` ya vetado
// contra el prototipo en `Spotlight.tsx:337-343` (el "Agregar al carrito" de la banda spotlight) y
// `StoreNav.tsx:656-660` (el CTA "Comprar" del encabezado, § CROMO-NAV-CTA-Y-BADGE-1): `sf-pildora`
// para el radio (0 bajo `forma:'recta'` de CORTE), `sf-borde` para el grosor del borde del contorno,
// mayúscula + tracking .085em + semibold, `py-[18px] px-[28px]` (`--button-pad-y`/`-x`), hover/active
// DERIVADOS del acento (`--sf-acento-3`/`-2`) sin hex nuevo — ningún valor de esta lista es inventado
// para este slice, todos ya circulan en el storefront bajo el mismo eje.
//
// `.btn--secondary` del prototipo (`css/app.css:137-142`) rellena a `--action-primary` (el acento
// CRUDO, no el matiz `-hover`) al pasar el mouse, y a `--action-primary-active` (el matiz `-active`,
// más oscuro) al presionar — por eso el hover de acá usa `--sf-acento` (no `-3`) y el active usa
// `--sf-acento-2`, la MISMA pareja que ya usa el primario para su propio active.
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
  'w-full flex items-center justify-center gap-2 sf-pildora bg-[var(--sf-acento)] hover:bg-[var(--sf-acento-3)] active:bg-[var(--sf-acento-2)] active:translate-y-px text-[var(--sf-acento-txt)] font-semibold uppercase tracking-[0.085em] py-[18px] px-[28px] transition-all duration-[120ms] text-sm cursor-pointer';
const SECUNDARIO_CORTE =
  'flex-1 flex items-center justify-center gap-2 sf-pildora sf-borde border-[var(--sf-acento)] text-[var(--sf-acento)] hover:bg-[var(--sf-acento)] hover:text-[var(--sf-acento-txt)] active:bg-[var(--sf-acento-2)] active:text-[var(--sf-acento-txt)] active:translate-y-px font-semibold uppercase tracking-[0.085em] py-[18px] px-[28px] transition-all duration-[120ms] text-sm cursor-pointer';

/**
 * Las clases de los dos botones de compra de `/tienda/[slug]`, según `tema.origenAccion`. Sólo
 * `'acento'` (CORTE, hoy el único preset que lo declara) recibe el tratamiento del prototipo; `null`
 * o `'tostado'` (todo lo demás, incluida Nayoli) cae byte a byte en lo que el JSX ya tenía.
 */
export function clasesBotonesCompra(origenAccion: OrigenAccionBotones): ClasesBotonesCompra {
  if (origenAccion === 'acento') {
    return { primario: PRIMARIO_CORTE, secundario: SECUNDARIO_CORTE };
  }
  return { primario: PRIMARIO_DEFECTO, secundario: SECUNDARIO_DEFECTO };
}
