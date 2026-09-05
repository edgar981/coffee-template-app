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
// PESOS por ROL, iguales a los de hoy (§ el `@import`): display 400;500;600, cuerpo 300;400;500;600;700.
// El costo de red se midió por par (latin, woff2 deduplicado): Editorial ~85 KB es el MÁS pesado; los
// otros cuatro pesan 12–19 KB MENOS. Ninguno pesa más — no hay nada que marcar.
//
// SORA reemplaza a Space Grotesk en 'Moderno' (decisión del owner): Space Grotesk es la tipografía de
// DUNA (el design system del panel), y ofrecerla a un cliente borraría la separación producto/cliente.
// Sora es otro grotesque geométrico —misma categoría visual, «Moderno» se conserva— pero es su propia
// fuente, distinta del producto que administra la tienda.
//
// PURO / client-safe: sin red, sin `server-only`. Lo consumen `fuentes-style` (el `<style>` del
// server), el layout del storefront (el `<link>`) y el picker del panel (`PaletaSeccion`).

// El tuple runtime del set cerrado — para el `z.enum` del schema del PUT (una sola fuente con el tipo).
export const CLAVES_FUENTES = ['editorial', 'calido', 'moderno', 'clasico', 'nitido'] as const;
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
    googleTitulo: 'Playfair+Display:wght@400;500;600', googleCuerpo: 'Inter:wght@300;400;500;600;700',
  },
  {
    clave: 'calido', label: 'Cálido', descripcion: 'Serif suave y redondeada, de tono cercano.',
    titulo: "'Fraunces', serif", cuerpo: "'Nunito Sans', sans-serif",
    googleTitulo: 'Fraunces:wght@400;500;600', googleCuerpo: 'Nunito+Sans:wght@300;400;500;600;700',
  },
  {
    clave: 'moderno', label: 'Moderno', descripcion: 'Grotesque geométrica, limpia y actual.',
    titulo: "'Sora', sans-serif", cuerpo: "'Inter', sans-serif",
    googleTitulo: 'Sora:wght@400;500;600', googleCuerpo: 'Inter:wght@300;400;500;600;700',
  },
  {
    clave: 'clasico', label: 'Clásico', descripcion: 'Serif de libro, serena y muy legible.',
    titulo: "'Lora', serif", cuerpo: "'Source Sans 3', sans-serif",
    googleTitulo: 'Lora:wght@400;500;600', googleCuerpo: 'Source+Sans+3:wght@300;400;500;600;700',
  },
  {
    clave: 'nitido', label: 'Nítido', descripcion: 'Sans geométrica de titulares con cuerpo neutro.',
    titulo: "'Poppins', sans-serif", cuerpo: "'Work Sans', sans-serif",
    googleTitulo: 'Poppins:wght@400;500;600', googleCuerpo: 'Work+Sans:wght@300;400;500;600;700',
  },
] as const;

const POR_CLAVE = new Map(PARES_FUENTES.map((p) => [p.clave, p]));

/** El default (Editorial): lo que representa `fuentePar === null`. */
export const PAR_DEFECTO = POR_CLAVE.get('editorial')!;

/** Los pares CUSTOM (todo menos el default). Un `fuentePar` guardado sólo puede ser uno de éstos. */
const CLAVES_CUSTOM = new Set<string>(['calido', 'moderno', 'clasico', 'nitido']);

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
 * vista previa refleja el elegido, así que el editor necesita las familias de los 5 a la vez—. Dedup
 * por spec (Inter aparece en Editorial y Moderno con el mismo peso). NO se usa en el storefront.
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
