// lib/config/spotlight.ts — § DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1, reescrito por
// § DESTACADO-PRESENTACION-POR-TAMANO-1
//
// Lógica PURA de la banda Spotlight que el storefront (`components/storefront/home/Spotlight.tsx`)
// y el panel (`TiendaSeccionEditor`, vía el picker de producto) comparten: derivar los DOS EJES
// (presentación, tamaño) de un producto del grupo a partir de DATO real del producto —nunca un
// literal inventado, misma familia que el "rating fabricado" que CLAUDE.md ya prohibió— y construir
// la MATRIZ presentación×tamaño del grupo pineado, para que los dos selectores del muestrario
// (`.scratch/refs/muestrario-destacado-pickers.webp`: "PRESENTACIÓN" Molido/En grano · "TAMAÑO" 250 g/
// 500 g, INDEPENDIENTES) elijan el producto correcto sin mezclar los dos ejes en un solo texto —el
// defecto medido contra el muestrario: `.scratch/refs/onix-destacado-pickers-mal.webp` mostraba
// "En grano · 500 g" en AMBOS selectores, y `.scratch/refs/onix-destacado-250-sin-molienda.webp`
// mostraba sólo "250 G" en la etiqueta sobre la foto del producto Molido 250 g (sin su presentación).
//
// § DESTACADO-PRESENTACION-POR-TAMANO-1 — EL EJE NUEVO: `spotlight` tiene hasta CUATRO punteros al
// catálogo (`SpotlightContent`, site-content-defaults.ts): `productoSlug` (el principal/pin),
// `presentacionSlug`, `otroTamanoSlug` y `cuartoSlug` — hasta cuatro productos del MISMO café que
// juntos arman la matriz 2×2 (presentación × tamaño) del muestrario. Los NOMBRES de los tres primeros
// campos NO cambiaron (§ "Migrá lo guardado hoy… sin perder la elección del owner" — el spec de este
// slice): lo que cambió es CÓMO se interpretan. Antes `presentacionSlug` era "la otra presentación,
// con el MISMO tamaño" y `otroTamanoSlug` "el otro tamaño, con la MISMA presentación" — dos punteros
// atados a un eje fijo cada uno. Ahora los CUATRO son simplemente "productos del grupo": sus ejes
// (presentación, tamaño) se DERIVAN de sus propios datos (`ejesSpotlight`, abajo) y la matriz se arma
// con lo que resulte — así que una fila guardada con la semántica VIEJA sigue siendo una matriz
// VÁLIDA bajo la semántica nueva (sus 2-3 productos simplemente ocupan las celdas que sus propios
// ejes determinen), sin tocar una sola clave del JSON guardado.

/** Los datos MÍNIMOS de un producto que `ejesSpotlight` necesita — genérico, no importa `Product`
 *  (mismo criterio que `ProductoVarianteSpotlight` antes de este slice): este módulo de CONFIG no
 *  depende del tipo de dominio del catálogo. */
export interface ProductoEjesSpotlight {
  slug: string;
  variante?: string | null;
  peso_gramos?: number | null;
  /** Ficha técnica — "Solo variantes molidas… undefined en grano entero" (§ types/product.ts). */
  molienda?: string | null;
}

export interface EjesSpotlight {
  /** Nunca vacío: con `variante`/`molienda` ausentes, cae a "En grano" (§ el docstring de
   *  `presentacionDeProducto`, abajo) — un producto SIEMPRE tiene una presentación, aunque no esté
   *  declarada explícitamente. */
  presentacion: string;
  /** `null` SÓLO si el producto no declara `peso_gramos` — el único de los dos ejes que puede faltar
   *  de verdad (no hay fallback honesto para un peso que nadie escribió). */
  tamano: string | null;
}

/** El TAMAÑO, siempre desde el campo ESTRUCTURADO `peso_gramos` — nunca de texto libre. Es el mismo
 *  campo que ya usa el Chip "Tamaño" del detalle de producto (`app/(storefront)/tienda/[slug]/
 *  page.tsx`), así que esta derivación no inventa una segunda fuente. */
function tamanoDeProducto(p: Pick<ProductoEjesSpotlight, 'peso_gramos'>): string | null {
  return p.peso_gramos != null ? `${p.peso_gramos} g` : null;
}

/**
 * La PRESENTACIÓN — derivada, nunca tecleada por esta función (§ el criterio de `etiquetaVarianteSpotlight`
 * de antes de este slice, que esta reescritura hereda: TODO lo que se muestra es DATO del producto).
 * Dos caminos, en orden, los DOS leídos del producto — "medí si se puede derivar, y si no, el
 * producto mismo declara la diferencia" (§ el spec de este slice):
 *
 *  1. `variante` ya es "<presentación> · <tamaño>" para los cuatro productos reales de este repo
 *     (medido: `prisma/seed-products.ts`, las cuatro variantes de Café Nayoli — "En grano · 250 g",
 *     "Molido · 250 g", etc.). Si el producto declara `variante` Y termina en " · <tamaño-derivado>",
 *     la presentación es lo que queda ANTES de ese sufijo — así el texto exacto que el dueño escribió
 *     en el producto es el que se muestra, nunca una palabra que esta función inventa.
 *  2. Sin `variante` utilizable, cae a la ficha técnica `molienda` (§ types/product.ts: "Solo
 *     variantes molidas… undefined en grano entero") — un producto CON molienda declarada es
 *     "Molido"; sin ella, "En grano". Es la MISMA distinción que ya existe en el modelo del
 *     producto, no una tercera clasificación inventada.
 */
function presentacionDeProducto(p: Pick<ProductoEjesSpotlight, 'variante' | 'peso_gramos' | 'molienda'>): string {
  const variante = (p.variante ?? '').trim();
  if (variante) {
    const tamano = tamanoDeProducto(p);
    const sufijo = tamano ? ` · ${tamano}` : null;
    if (sufijo && variante.endsWith(sufijo)) {
      const resto = variante.slice(0, -sufijo.length).trim();
      if (resto) return resto;
    } else if (!sufijo) {
      // Sin peso_gramos para construir el sufijo exacto: un separador genérico "<algo> · <algo>"
      // sigue siendo una señal razonable de que la primera mitad es la presentación.
      const partes = variante.split(' · ');
      if (partes.length === 2 && partes[0].trim()) return partes[0].trim();
    }
  }
  return p.molienda ? 'Molido' : 'En grano';
}

/** Los DOS ejes de un producto del grupo — § el docstring de cabecera. */
export function ejesSpotlight(p: ProductoEjesSpotlight): EjesSpotlight {
  return { presentacion: presentacionDeProducto(p), tamano: tamanoDeProducto(p) };
}

export interface MiembroGrupoSpotlight<T> {
  producto: T;
  ejes: EjesSpotlight;
}

/** El grupo de productos (hasta 4: el pin + los alternos configurados), con sus ejes ya derivados —
 *  lo que el panel necesita para mostrar "la combinación de cada uno" (§ el spec) y lo que el
 *  storefront necesita para armar la matriz. */
export function grupoSpotlight<T extends ProductoEjesSpotlight>(productos: readonly T[]): MiembroGrupoSpotlight<T>[] {
  return productos.map((producto) => ({ producto, ejes: ejesSpotlight(producto) }));
}

/** Los valores ÚNICOS de UN eje dentro del grupo, en el orden en que aparecen (primer producto que
 *  lo trae, primero) — NO alfabético: es el orden en que el dueño armó el grupo (el pin manda). Un
 *  eje con un solo valor es "no hay nada entre qué elegir" — el componente decide, con esto, si
 *  muestra el selector (§ Spotlight.tsx: "con un solo valor no se muestra", el mismo criterio que ya
 *  regía las flechas del escenario con una sola vista). */
export function valoresDeEje<T>(grupo: readonly MiembroGrupoSpotlight<T>[], eje: 'presentacion' | 'tamano'): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const m of grupo) {
    const v = m.ejes[eje];
    if (v && !vistos.has(v)) {
      vistos.add(v);
      out.push(v);
    }
  }
  return out;
}

/**
 * El producto cuya combinación (presentación, tamaño) coincide EXACTO con lo elegido — `null` si el
 * grupo no tiene ningún producto para esa combinación. NO es un error: es "esa celda de la matriz no
 * existe" (§ el spec: "Combinación sin producto: la opción se ve deshabilitada, no desaparece el
 * selector") — el componente usa este `null` para decidir qué botón queda `disabled`, no para caer a
 * ningún fallback silencioso.
 */
export function productoDeCombinacion<T>(
  grupo: readonly MiembroGrupoSpotlight<T>[],
  presentacion: string | null,
  tamano: string | null,
): T | null {
  const match = grupo.find((m) => m.ejes.presentacion === presentacion && m.ejes.tamano === tamano);
  return match ? match.producto : null;
}

/** La etiqueta sobre la foto (§ el spec: "siempre dice molienda y peso") — "presentación · peso",
 *  o sólo la presentación si el producto no declara `peso_gramos`. Nunca el nombre de una opción de
 *  `moliendasOpciones` (el defecto que esto reemplaza): esas son niveles de MOLIENDA dentro de UN
 *  producto molido (p. ej. "Media" vs "Fina"), un eje distinto del de presentación/tamaño. */
export function etiquetaEjesSpotlight(ejes: EjesSpotlight): string {
  return ejes.tamano ? `${ejes.presentacion} · ${ejes.tamano}` : ejes.presentacion;
}

// ── EL NOMBRE FIJO DEL CAFÉ — § DESTACADO-NOMBRE-GRUPO-Y-TRANSICION-1 ─────────────────────────────
//
// Gate del owner tras DESTACADO-PRESENTACION-POR-TAMANO-1: «En destacado... el nombre que salga sea
// solamente café Onix, en lugar de: "Café Onix — Molido 250 g"... se produce un cambio brusco entre
// saltos». El DEFECTO era DOBLE: el h3 de `Spotlight.tsx` mostraba `activo.nombre` —el nombre del
// producto de la CELDA elegida de la matriz, que CAMBIA con la selección (§ `productoDeCombinacion`)—
// en vez del nombre del GRUPO entero (fijo); y ese nombre, además, lleva la variante pegada
// ("<café> — <presentación> <peso>", medido: `prisma/seed-products.ts`, las cuatro variantes reales
// de Café Nayoli). Corregir sólo el recorte sin fijar la FUENTE (`activo` → `producto`, el pin, que
// NUNCA cambia con la selección) habría dejado el nombre saltando igual entre "Café Nayoli" (En
// grano) y "Café Nayoli" (Molido) — coincidencia de ESTE seed, no garantía del modelo: dos
// productos del grupo pueden declarar nombres de café DISTINTOS a mano.

/** Los datos MÍNIMOS que `nombreCafeSpotlight` necesita del producto PRINCIPAL del grupo (el pin) —
 *  genérico, mismo criterio que `ProductoEjesSpotlight`: este módulo de CONFIG no depende del tipo
 *  de dominio del catálogo. */
export interface ProductoNombreSpotlight {
  nombre: string;
}

const SEPARADOR_VARIANTE = ' — ';

/**
 * El nombre FIJO que el título de la ficha muestra — nunca el del producto ACTIVO (que cambia con
 * la selección de Presentación/Tamaño), siempre el del PRINCIPAL (el pin, `producto` en
 * `Spotlight.tsx` — el único de los dos que no cambia con la selección). DOS caminos, en ese orden —
 * el mismo criterio que `presentacionDeProducto` (arriba): "medí si se puede derivar, y si no, el
 * producto mismo declara la diferencia":
 *
 *  1. `nombreCafe` (`SpotlightContent.nombreCafe`, el campo EDITORIAL del panel) — si el dueño lo
 *     escribió, GANA tal cual. Cubre el caso en que el recorte automático de abajo no alcanza (un
 *     nombre sin el separador, o uno que lo necesita distinto).
 *  2. Sin ese campo (vacío), se DERIVA del nombre del producto: corta en el separador EXACTO
 *     " — " (el que usa `prisma/seed-products.ts`) y se queda con lo de ANTES — el nombre del café,
 *     sin la variante. Sin ese separador (un nombre que no lo trae), el nombre ENTERO — nunca una
 *     cadena vacía por cortar de más, ni un corte parcial sobre un guion simple ("-") que no es el
 *     separador declarado.
 */
export function nombreCafeSpotlight(principal: ProductoNombreSpotlight, nombreCafe: string): string {
  const configurado = nombreCafe.trim();
  if (configurado) return configurado;
  const nombre = principal.nombre;
  const idx = nombre.indexOf(SEPARADOR_VARIANTE);
  if (idx < 0) return nombre;
  const resto = nombre.slice(0, idx).trim();
  return resto || nombre;
}

// ── EL NOMBRE PERTENECE AL PRINCIPAL — § EDITOR-ARREGLOS-TITULAR-DESTACADO-1 ──────────────────────
//
// Bug 2 del owner: eligió otro producto para destacar, la descripción cambió, y el NOMBRE se quedó
// siendo el del producto ANTERIOR. La causa está arriba, en el propio diseño de `nombreCafeSpotlight`:
// `nombreCafe` es un override que GANA sobre lo que se deriva del `principal` — correcto mientras el
// `principal` sea EL MISMO café (es justo lo que permite que el nombre "no cambie al elegir otra
// presentación o tamaño", § su hint en `components/admin/tienda-secciones.ts`), pero si el PIN mismo
// cambia a OTRO café, ese override sigue "ganando" con el nombre de un café que ya no es el que se
// muestra. El nombre editorial pertenece al producto CON EL QUE SE ESCRIBIÓ, no a la sección entera.
//
// Por eso el PIN (`productoSlug`) es el ÚNICO de los cuatro punteros del grupo que dispara esto — los
// otros tres (`presentacionSlug`/`otroTamanoSlug`/`cuartoSlug`) son el MISMO café en otra talla, y
// `nombreCafe` está diseñado a propósito para NO cambiar ahí.
/** El PARCIAL a aplicar cuando el picker de `productoSlug` (el PIN de Destacado) cambia de valor:
 *  el slug nuevo, y `nombreCafe` LIMPIO — nunca el override del café anterior sobreviviendo al
 *  cambio de café. Deshacer (`TiendaSeccionEditor.tsx`, el mismo paso de historial que cualquier
 *  cambio de campo) lo devuelve igual que cualquier otro campo. */
export function parcialAlCambiarPinSpotlight(nuevoSlug: string): { productoSlug: string; nombreCafe: string } {
  return { productoSlug: nuevoSlug, nombreCafe: '' };
}
