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
// PESOS por ROL: display **UN SOLO PESO (400)** en los NUEVE pares; cuerpo 300;400;500;600;700 (sin
// cambio). (§ FUENTES-PESOS-DISPLAY-SOBRAN-1, 2026-09-12): el storefront pinta el rol DISPLAY —
// `.font-display`/`.font-playfair`— con el peso 400 SIEMPRE (verificado: cero clases de peso Tailwind
// —font-semibold/medium/bold/light/…—, cero `fontWeight` inline, cero regla `font-weight` en
// globals.css sobre esas clases, en TODO `app/(storefront)` y `components/storefront`; los `h1..h6`
// no heredan bold del user-agent porque el preflight de Tailwind los resetea a `font-weight: inherit`).
// Pedir 500/600 descargaba un archivo de fuente por peso que ningún elemento pinta — el navegador no
// falla, SINTETIZA un bold falso si algo llegara a usarlo sin el peso pedido; el test de este archivo
// afirma que los nueve piden el MISMO conjunto (hoy, sólo `400`), para que ninguno pueda divergir en
// silencio. 'Técnico' YA venía recortado a `400;600` (IBM Plex Mono no es variable en Google Fonts, así
// que cada peso es un archivo estático propio) y ahora pierde también el 600 sobrante, igual que los
// otros ocho pierden 500;600 — el delta es distinto (1 peso vs. 2), el estado final es el mismo.
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
export const CLAVES_FUENTES = ['editorial', 'calido', 'moderno', 'clasico', 'nitido', 'robusta', 'tecnico', 'relato', 'cercano'] as const;
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
] as const;

const POR_CLAVE = new Map(PARES_FUENTES.map((p) => [p.clave, p]));

/** El default (Editorial): lo que representa `fuentePar === null`. */
export const PAR_DEFECTO = POR_CLAVE.get('editorial')!;

/** Los pares CUSTOM (todo menos el default). Un `fuentePar` guardado sólo puede ser uno de éstos. */
const CLAVES_CUSTOM = new Set<string>(['calido', 'moderno', 'clasico', 'nitido', 'robusta', 'tecnico', 'relato', 'cercano']);

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
 * Las dos vars `--sf-fuente-*` para un par, para un `style` INLINE (la vista previa del panel, que no
 * pasa por el `<style>` server de cssFuentes). Editorial/null → `{}`: sin override, las clases `.font-*`
 * caen a su fallback Inter/Playfair (cargadas en el panel por el `@import`).
 */
export function varsDeFuentePar(fuentePar: ClaveFuentePar | null): Record<string, string> {
  const clave = resolverFuentePar(fuentePar);
  if (!clave) return {};
  const par = parDeFuentePar(clave);
  return { '--sf-fuente-titulo': par.titulo, '--sf-fuente-cuerpo': par.cuerpo };
}
