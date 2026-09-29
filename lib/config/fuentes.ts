// El SET CERRADO de pares tipográficos del storefront (§ Tanda C2 · #3 fuentes). Un cliente elige UN
// par —display + cuerpo—; no hay campo de fuente libre (evita que suba una fuente rota o una que
// borre la separación producto/cliente). El par vive en `content.tema.fuentePar` (gemelo de las 3
// raíces de paleta), y de él salen: las dos vars `--sf-fuente-*` que leen las clases `.font-*`
// (§ globals.css) y el `<link>` de Google Fonts del despliegue.
//
// NULL = EDITORIAL (el default), como null en las raíces = fábrica: sin override, las clases `.font-*`
// caen a su fallback (Inter/Playfair, que carga el `@import` de globals.css) → Nayoli byte-idéntico.
// Por eso `editorial` NUNCA se guarda: el picker manda `null` para Editorial (§ resolverFuentePar).
//
// PESOS por ROL: display **UN SOLO PESO (400)** en los DIEZ pares; cuerpo 300;400;500;600;700 en
// NUEVE de los diez ('prensa' pide un RANGO — ver su docstring y § CORTE-CUERPO-FIGTREE-PESO-1,
// abajo). (§ FUENTES-PESOS-DISPLAY-SOBRAN-1, 2026-09-12): el storefront pinta el rol DISPLAY —
// `.font-display`/`.font-playfair`— con el peso 400 SIEMPRE. **Esto YA NO es sólo AUSENCIA de una
// regla** (§ CORTE-CUERPO-FIGTREE-PESO-1: `globals.css` ganó `font-weight:400` explícito en esas dos
// clases, en `@layer base` —por debajo de `utilities`, para que `font-semibold`/`.font-medium`/etc.
// sigan ganando donde se combinan con ellas— porque el CUERPO ahora puede declarar un peso propio vía
// `--sf-peso-cuerpo`, y sin el candado ese peso se COLARÍA a título por herencia, vía cualquier
// `.font-display`/`.font-playfair` sin una clase de peso propia — el wordmark del `Logo` y el título
// del marquee de `HeroMediaMarquesina` son los dos casos reales que lo habrían sufrido). Verificado:
// cero clases de peso Tailwind —font-semibold/medium/bold/light/…—, cero `fontWeight` inline, en TODO
// `app/(storefront)` y `components/storefront`; los `h1..h6` no heredan bold del user-agent porque el
// preflight de Tailwind los resetea a `font-weight: inherit`, y el candado de `base` gana sobre ese
// `inherit` (una regla declarada siempre gana a un valor heredado, sea cual sea su layer).
// Pedir 500/600 descargaba un archivo de fuente por peso que ningún elemento pinta — el navegador no
// falla, SINTETIZA un bold falso si algo llegara a usarlo sin el peso pedido; el test de este archivo
// afirma que los diez piden el MISMO conjunto (hoy, sólo `400`) de DISPLAY, para que ninguno pueda
// divergir en silencio. 'Técnico' YA venía recortado a `400;600` (IBM Plex Mono no es variable en
// Google Fonts, así que cada peso es un archivo estático propio) y ahora pierde también el 600
// sobrante, igual que los otros ocho pierden 500;600 — el delta es distinto (1 peso vs. 2), el estado
// final es el mismo.
// El costo de red de los CINCO PRIMEROS se midió por par ANTES de este recorte (latin, woff2
// deduplicado, con display en 400;500;600 o 400;600 para Técnico): Editorial ~85 KB era el MÁS pesado;
// Cálido/Moderno/Clásico/Nítido pesaban 12–19 KB MENOS. El único que SUBÍA era 'Técnico': ~94 KB
// recortado (+9 sobre Editorial; ~118/+33 sin el recorte de display). Las cifras de los CUATRO NUEVOS
// eran ESTIMACIONES de la propuesta de diseño, NO medidas contra el CDN: Robusta ~68 KB (−17 est.),
// Técnico ~94 KB (+9 est., recortado a 400;600), Relato ~80 KB (−5 est.), Cercano ~66 KB (−19 est.).
// Estos números son el estado ANTERIOR a este slice — bajan con el recorte a un solo peso de display,
// pero no se re-midieron contra el CDN (§ FUENTES-PESOS-DISPLAY-SOBRAN-1 lo deja como estimación).
//
// SORA reemplaza a Space Grotesk en 'Moderno' (decisión del owner): Space Grotesk es la tipografía de
// DUNA (el design system del panel), y ofrecerla a un cliente borraría la separación producto/cliente.
// Sora es otro grotesque geométrico —misma categoría visual, «Moderno» se conserva— pero es su propia
// fuente, distinta del producto que administra la tienda.
//
// PURO / client-safe: sin red, sin `server-only`. Lo consumen `fuentes-style` (el `<style>` del
// server), el layout del storefront (el `<link>`) y el picker del panel (`PaletaSeccion`).

// El tuple runtime del set cerrado — para el `z.enum` del schema del PUT (una sola fuente con el tipo).
export const CLAVES_FUENTES = ['editorial', 'calido', 'moderno', 'clasico', 'nitido', 'robusta', 'tecnico', 'relato', 'cercano', 'prensa'] as const;
export type ClaveFuentePar = (typeof CLAVES_FUENTES)[number];

export interface ParFuentes {
  clave: ClaveFuentePar;
  label: string;
  descripcion: string;
  /** Valor CSS `font-family` del rol DISPLAY (títulos, wordmark) — con su genérico de fallback. */
  titulo: string;
  /** Valor CSS `font-family` del rol CUERPO (texto) — con su genérico de fallback. */
  cuerpo: string;
  /** Spec `family=…` de Google Fonts css2 para el DISPLAY (familia + pesos del rol). */
  googleTitulo: string;
  /** Spec `family=…` de Google Fonts css2 para el CUERPO. */
  googleCuerpo: string;
  /**
   * PESO regular de LECTURA del rol CUERPO, en gramos (§ CORTE-CUERPO-FIGTREE-PESO-1). AUSENTE
   * (`undefined`) = 400, el peso de HOY — los otros NUEVE pares no lo declaran. Sólo 'prensa' trae
   * un valor: es la calibración de Figtree contra Hanken Grotesk del muestrario (ver el docstring de
   * 'prensa', abajo, para el porqué del NÚMERO y por qué NO se agregó Hanken al catálogo). `varsDe
   * FuentePar`/`cssFuentes` sólo emiten `--sf-peso-cuerpo` cuando este campo está presente —su
   * AUSENCIA es la señal de "sin override", igual que `fuentePar`/`forma` en `null`—, así que los
   * otros nueve pares no cambian ni un byte del `:root` que inyectan hoy.
   */
  pesoCuerpo?: number;
}

// El registro. `editorial` va PRIMERO (es el default) y su muestra en el picker representa "las de hoy".
export const PARES_FUENTES: readonly ParFuentes[] = [
  {
    clave: 'editorial', label: 'Editorial', descripcion: 'Serif clásica con una sans legible. La de Nayoli.',
    titulo: "'Playfair Display', serif", cuerpo: "'Inter', sans-serif",
    googleTitulo: 'Playfair+Display:wght@400', googleCuerpo: 'Inter:wght@300;400;500;600;700',
  },
  {
    clave: 'calido', label: 'Cálido', descripcion: 'Serif suave y redondeada, de tono cercano.',
    titulo: "'Fraunces', serif", cuerpo: "'Nunito Sans', sans-serif",
    googleTitulo: 'Fraunces:wght@400', googleCuerpo: 'Nunito+Sans:wght@300;400;500;600;700',
  },
  {
    clave: 'moderno', label: 'Moderno', descripcion: 'Grotesque geométrica, limpia y actual.',
    titulo: "'Sora', sans-serif", cuerpo: "'Inter', sans-serif",
    googleTitulo: 'Sora:wght@400', googleCuerpo: 'Inter:wght@300;400;500;600;700',
  },
  {
    clave: 'clasico', label: 'Clásico', descripcion: 'Serif de libro, serena y muy legible.',
    titulo: "'Lora', serif", cuerpo: "'Source Sans 3', sans-serif",
    googleTitulo: 'Lora:wght@400', googleCuerpo: 'Source+Sans+3:wght@300;400;500;600;700',
  },
  {
    clave: 'nitido', label: 'Nítido', descripcion: 'Sans geométrica de titulares con cuerpo neutro.',
    titulo: "'Poppins', sans-serif", cuerpo: "'Work Sans', sans-serif",
    googleTitulo: 'Poppins:wght@400', googleCuerpo: 'Work+Sans:wght@300;400;500;600;700',
  },
  {
    clave: 'robusta', label: 'Robusta', descripcion: 'condensada de impacto, con cuerpo grotesque industrial.',
    titulo: "'Oswald', sans-serif", cuerpo: "'Archivo', sans-serif",
    googleTitulo: 'Oswald:wght@400', googleCuerpo: 'Archivo:wght@300;400;500;600;700',
  },
  {
    // DISPLAY a un solo peso (400), como los otros ocho: IBM Plex Mono no es variable en Google Fonts
    // (cada peso es un archivo estático propio), así que ya venía recortado a 400;600; el 600 también
    // sobraba (§ FUENTES-PESOS-DISPLAY-SOBRAN-1) — su delta es de 1 peso, no de 2, pero el destino es el mismo.
    clave: 'tecnico', label: 'Técnico', descripcion: 'monoespaciada de titular, del registro de la hoja de cata.',
    titulo: "'IBM Plex Mono', monospace", cuerpo: "'IBM Plex Sans', sans-serif",
    googleTitulo: 'IBM+Plex+Mono:wght@400', googleCuerpo: 'IBM+Plex+Sans:wght@300;400;500;600;700',
  },
  {
    clave: 'relato', label: 'Relato', descripcion: 'sans de titular con cuerpo serif, para quien escribe párrafos.',
    titulo: "'Familjen Grotesk', sans-serif", cuerpo: "'Source Serif 4', serif",
    googleTitulo: 'Familjen+Grotesk:wght@400', googleCuerpo: 'Source+Serif+4:wght@300;400;500;600;700',
  },
  {
    clave: 'cercano', label: 'Cercano', descripcion: 'geometría redonda y dulce, sin ninguna serif.',
    titulo: "'Quicksand', sans-serif", cuerpo: "'Mulish', sans-serif",
    googleTitulo: 'Quicksand:wght@400', googleCuerpo: 'Mulish:wght@300;400;500;600;700',
  },
  {
    clave: 'prensa', label: 'Prensa',
    descripcion: 'Serif moderno de bajo contraste con una grotesca geométrica. Sobrio y actual, sin el dramatismo de un didone.',
    titulo: "'Roboto Serif', serif", cuerpo: "'Figtree', sans-serif",
    // EL CUERPO PIDE UN RANGO (`300..700`), NO LA LISTA DISCRETA de los otros nueve pares
    // (§ CORTE-CUERPO-FIGTREE-PESO-1) — es lo que hace RENDERIZABLE el `pesoCuerpo` de abajo.
    // MEDIDO por ejecución contra `fonts.googleapis.com` (Chrome UA): pedir `wght@300;400;500;600;700`
    // devuelve CINCO `@font-face` con `font-weight` DISCRETO (300/400/500/600/700), los CINCO
    // apuntando al MISMO archivo .woff2 (Figtree ya es variable; Google sólo declara caras puntuales
    // sobre el mismo binario). Con caras puntuales, el algoritmo de font-matching de CSS busca la cara
    // MÁS CERCANA entre las declaradas — `font-weight:440` cae en la cara 500 (busca hacia arriba
    // primero dentro de [peso,500]), NO en un 440 interpolado: el navegador NUNCA ve ese número. Pedir
    // `wght@300..700` (RANGO) da DOS `@font-face` (los mismos 2 subsets de unicode) con `font-weight:
    // 300 700` — el MISMO archivo .woff2 exacto (bytes idénticos, mismas URLs) declarado como capaz de
    // CUALQUIER peso en ese tramo, así que `font-weight:440` SÍ interpola el eje `wght` de la fuente
    // variable al valor exacto. Como nadie más que CORTE usa 'prensa', y el archivo descargado es
    // BYTE A BYTE el mismo con cualquiera de las dos sintaxis, este cambio no mueve el peso de ningún
    // otro tenant ni agrega descarga.
    googleTitulo: 'Roboto+Serif:wght@400', googleCuerpo: 'Figtree:wght@300..700',
    // PESO DE CUERPO CALIBRADO (§ CORTE-CUERPO-FIGTREE-PESO-1, decisión del owner sobre la
    // RULING_NEEDED de CORTE-CUERPO-LETRA-E-ICONOS-1: "Figtree más gruesa", NO agregar Hanken
    // Grotesk — esa fuente sigue reservada a Duna, § "SORA reemplaza a Space Grotesk" arriba). El
    // muestrario pinta su cuerpo con Hanken Grotesk 400; medido con fontTools (Google Fonts,
    // `ofl/hankengrotesk`/`ofl/figtree`, unidades/em=1000) sobre "TIENDA NOSOTROS SUSCRIPCIONES CAFE"
    // (el nav, donde más se nota) y la frase del pie: Hanken 400 da tinta≈218.3 (nav)/185.4 (frase);
    // Figtree 400 da 204.4/183.7 — MÁS LIVIANA en las dos; Figtree 500 da 235.7/210.3 — MÁS PESADA que
    // Hanken en las dos. Interpolando linealmente entre Figtree 400 y 500 para IGUALAR la tinta de
    // Hanken: ~444 por el nav, ~405 por la frase — el nav pesa más en la decisión (es donde el owner
    // reportó el defecto), así que el valor elegido es 440. NO es 400 (seguiría leyéndose más liviana
    // que el muestrario) ni 500 (la sobrepasaría). Con el rango de arriba, el navegador renderiza
    // exactamente este número, no la cara 500 más cercana.
    pesoCuerpo: 440,
  },
] as const;

const POR_CLAVE = new Map(PARES_FUENTES.map((p) => [p.clave, p]));

/** El default (Editorial): lo que representa `fuentePar === null`. */
export const PAR_DEFECTO = POR_CLAVE.get('editorial')!;

/** Los pares CUSTOM (todo menos el default). Un `fuentePar` guardado sólo puede ser uno de éstos. */
const CLAVES_CUSTOM = new Set<string>(['calido', 'moderno', 'clasico', 'nitido', 'robusta', 'tecnico', 'relato', 'cercano', 'prensa']);

/**
 * Normaliza el `fuentePar` guardado a una clave CUSTOM válida, o `null` (= Editorial, el default).
 * `null`, `'editorial'`, o cualquier basura → `null`: Editorial nunca se guarda (el default es "sin
 * override"), igual que las raíces de paleta en null = fábrica. Defensa del loader SOFT (§ resolverTema).
 */
export function resolverFuentePar(v: unknown): ClaveFuentePar | null {
  return typeof v === 'string' && CLAVES_CUSTOM.has(v) ? (v as ClaveFuentePar) : null;
}

/** El par resuelto (el CUSTOM guardado, o el default Editorial). Nunca null. */
export function parDeFuentePar(fuentePar: ClaveFuentePar | null): ParFuentes {
  return (fuentePar && POR_CLAVE.get(fuentePar)) || PAR_DEFECTO;
}

/** URL de Google Fonts css2 para UN par (sus dos familias con los pesos del rol). */
export function urlGoogle(par: ParFuentes): string {
  return `https://fonts.googleapis.com/css2?family=${par.googleTitulo}&family=${par.googleCuerpo}&display=swap`;
}

/**
 * El `<link>` del par ELEGIDO para el storefront, o `null` para Editorial/null: Editorial NO lleva
 * link —lo cubre el `@import` de globals.css (§ el default byte-idéntico)—; sólo un par CUSTOM inyecta
 * su `<link>` y descarga sus 2 familias. Así, por despliegue se descargan 2 familias (las del par).
 */
export function linkFuentePar(fuentePar: ClaveFuentePar | null): string | null {
  const clave = resolverFuentePar(fuentePar);
  return clave ? urlGoogle(parDeFuentePar(clave)) : null;
}

/**
 * UN `<link>` que carga TODOS los pares —para el PANEL: el picker muestra una muestra por par y la
 * vista previa refleja el elegido, así que el editor necesita todas las familias a la vez—. Dedup
 * por spec (Inter aparece en Editorial y Moderno con el mismo peso — el único par que comparte
 * familia con otro). NO se usa en el storefront.
 */
export function linkFuentesTodas(): string {
  const specs = new Set<string>();
  for (const p of PARES_FUENTES) { specs.add(p.googleTitulo); specs.add(p.googleCuerpo); }
  return `https://fonts.googleapis.com/css2?${[...specs].map((s) => `family=${s}`).join('&')}&display=swap`;
}

/**
 * Las vars `--sf-fuente-*`/`--sf-peso-cuerpo` para un par, para un `style` INLINE (la vista previa
 * del panel, que no pasa por el `<style>` server de cssFuentes — la usa `FragmentoTienda`,
 * `PaletaSeccion.tsx`, spreadeada sobre el div `.font-inter` que envuelve el fragmento real). Editorial/
 * null → `{}`: sin override, las clases `.font-*` caen a su fallback Inter/Playfair (cargadas en el
 * panel por el `@import`). `--sf-peso-cuerpo` sólo aparece si el par declara `pesoCuerpo`
 * (§ CORTE-CUERPO-FIGTREE-PESO-1) — su AUSENCIA en el objeto (no un `'400'` explícito) es la señal de
 * "sin override" para los otros nueve pares, igual que `fuentePar`/`forma` en `null`.
 */
export function varsDeFuentePar(fuentePar: ClaveFuentePar | null): Record<string, string> {
  const clave = resolverFuentePar(fuentePar);
  if (!clave) return {};
  const par = parDeFuentePar(clave);
  const vars: Record<string, string> = { '--sf-fuente-titulo': par.titulo, '--sf-fuente-cuerpo': par.cuerpo };
  if (par.pesoCuerpo !== undefined) vars['--sf-peso-cuerpo'] = String(par.pesoCuerpo);
  return vars;
}
