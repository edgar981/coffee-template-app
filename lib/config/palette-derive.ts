// ─── EL MOTOR DE COLOR DEL STOREFRONT · derivar 20 tintas de 3 RAÍCES ─────────
//
// El cliente elige 3 RAÍCES —fondo · tinta · acento—; las otras 17 tintas del
// storefront (§ globals.css `--sf-*`) se DERIVAN acá. 18 colores no son
// configurables; 3 sí. La derivación es una mezcla en OKLCH con un peso por token
// (los pesos REPRODUCEN la paleta de Nayoli dentro de ~1 JND — medido; era, en su
// mayoría, una mezcla de 2 raíces) MÁS un PISO DE CONTRASTE sobre los roles de texto.
//
// PURO: sin `server-only`, sin red. Lo llama el layout del storefront (inyecta) y lo
// prueba la capa 1. Nayoli NO deriva —cae a los defaults de código (byte-idéntico)—;
// esto corre sólo para un cliente que setea sus raíces.
//
// ── LA REGLA DE DIRECCIÓN DEL PISO ──────────────────────────────────────────
// Texto sobre CLARO pisa hacia OSCURO; texto sobre OSCURO pisa hacia CLARO. Y en la
// práctica **sólo el acento-sobre-claro necesita el piso**: los otros roles de texto
// son oscuros por naturaleza (`texto`/`textoSuave` nacen de una mezcla hacia tinta) o
// son claros-sobre-oscuro (`tostado`/`fondo` como texto viven sobre el hero/footer, y
// un derivado claro SIGUE claro aunque el acento sea neón). Por eso el piso se aplica a
// `texto`, `textoSuave` y `acentoTexto` —los tres que van como texto sobre fondo— y a
// NADA MÁS. No "completar la simetría" floreando tonos claros-sobre-oscuro: no lo
// necesitan, y oscurecerlos los rompería en su fondo real.

export type RaicesPaleta = { fondo: string; tinta: string; acento: string };
export type PaletaDerivada = Record<string, string>; // clave = nombre de var sin `--sf-`

/** Las 3 RAÍCES por defecto = la paleta de Nayoli (§ globals.css `--sf-fondo/tinta/acento`). Un
 *  deployment sin `content.tema` (raíces null) DERIVA de éstas. Fuente ÚNICA para los consumidores
 *  server (buildBrand · los correos) y cliente (PaletaSeccion · el editor). */
export const RAICES_DEFECTO: RaicesPaleta = { fondo: '#faf7f4', tinta: '#1a0f08', acento: '#8b4513' };

// ── OKLab / OKLCH (sRGB↔OKLab, mezcla en oklch, WCAG) ────────────────────────
const srgbToLin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const linToSrgb = (c: number) => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(v * 255))); };
type Lab = { L: number; a: number; b: number };
function hexToOklab(hex: string): Lab {
  const r = srgbToLin(parseInt(hex.slice(1, 3), 16)), g = srgbToLin(parseInt(hex.slice(3, 5), 16)), b = srgbToLin(parseInt(hex.slice(5, 7), 16));
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b, m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b, s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return { L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_, a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_, b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_ };
}
function oklabToHex({ L, a, b }: Lab): string {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return '#' + [linToSrgb(r), linToSrgb(g), linToSrgb(bb)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
type Lch = { L: number; C: number; H: number };
const labToLch = ({ L, a, b }: Lab): Lch => ({ L, C: Math.hypot(a, b), H: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 });
const lchToLab = ({ L, C, H }: Lch): Lab => ({ L, a: C * Math.cos(H * Math.PI / 180), b: C * Math.sin(H * Math.PI / 180) });

/** Mezcla dos hex en OKLCH al peso `w` (hue por arco corto), como `color-mix(in oklch)`. */
export function mezclar(h1: string, h2: string, w: number): string {
  const c1 = labToLch(hexToOklab(h1)), c2 = labToLch(hexToOklab(h2));
  let dh = c2.H - c1.H; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
  return oklabToHex(lchToLab({ L: c1.L + (c2.L - c1.L) * w, C: c1.C + (c2.C - c1.C) * w, H: (c1.H + dh * w + 360) % 360 }));
}
/** Contraste WCAG entre dos hex (1..21). */
export function contraste(a: string, b: string): number {
  const lum = (hex: string) => { const f = (i: number) => srgbToLin(parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * f(1) + 0.7152 * f(3) + 0.0722 * f(5); };
  const l1 = lum(a), l2 = lum(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
/** Oscurece `hex` (baja L en OKLCH) hasta alcanzar `objetivo:1` de contraste sobre `bg`.
 *  El piso de contraste: garantiza que un rol de TEXTO sobre fondo claro se lea, sea cual
 *  sea el acento del cliente (un neón se oscurece a oro legible; un acento ya oscuro no se toca). */
export function pisoContraste(hex: string, bg: string, objetivo = 4.5): string {
  let lch = labToLch(hexToOklab(hex)), out = hex;
  for (let i = 0; i < 140 && contraste(out, bg) < objetivo; i++) { lch = { ...lch, L: Math.max(0, lch.L - 0.008) }; out = oklabToHex(lchToLab(lch)); }
  return out;
}

// Los pesos que reproducen a Nayoli (medido, best-fit por token). `piso: true` = rol de
// TEXTO sobre fondo → se florea. El resto NO se florea (superficie, decorativo, o
// claro-sobre-oscuro). Ver la regla de dirección arriba.
const RECETA: Record<string, { a: keyof RaicesPaleta; b: keyof RaicesPaleta; w: number; piso?: boolean }> = {
  superficie:   { a: 'fondo',  b: 'acento', w: 0.09 },
  linea:        { a: 'fondo',  b: 'acento', w: 0.16 },
  'superficie-2': { a: 'fondo', b: 'acento', w: 0.21 },
  'tinta-2':    { a: 'tinta',  b: 'acento', w: 0.19 },
  'acento-2':   { a: 'acento', b: 'tinta',  w: 0.64 },
  'acento-3':   { a: 'acento', b: 'tinta',  w: 0.41 },
  'acento-4':   { a: 'acento', b: 'fondo',  w: 0.31 },
  'acento-texto': { a: 'acento', b: 'acento', w: 0, piso: true }, // = acento, luego piso sobre fondo
  texto:        { a: 'acento', b: 'tinta',  w: 0.34, piso: true },
  'texto-suave':{ a: 'acento', b: 'tinta',  w: 0.12, piso: true },
  tostado:      { a: 'acento', b: 'fondo',  w: 0.56 },
  'tostado-2':  { a: 'acento', b: 'fondo',  w: 0.51 },
  'tostado-3':  { a: 'acento', b: 'fondo',  w: 0.24 },
  'tostado-4':  { a: 'acento', b: 'fondo',  w: 0.43 },
  'tostado-5':  { a: 'acento', b: 'fondo',  w: 0.48 },
  'tostado-6':  { a: 'acento', b: 'fondo',  w: 0.71 },
  'tostado-7':  { a: 'acento', b: 'fondo',  w: 0.71 },
  'tostado-8':  { a: 'acento', b: 'fondo',  w: 0.64 },
};

/**
 * Deriva las 20 tintas `--sf-*` de las 3 raíces. Devuelve un mapa {nombre → hex} listo
 * para inyectar como CSS vars. Las 3 raíces se copian tal cual; el resto se mezcla; los
 * roles de texto se florean sobre el fondo.
 */
export function derivarPaleta(raices: RaicesPaleta): PaletaDerivada {
  const { fondo, tinta, acento } = raices;
  const out: PaletaDerivada = { fondo, tinta, acento };
  for (const [nombre, r] of Object.entries(RECETA)) {
    // `a === b` (p.ej. acento-texto) = el hex CRUDO, sin `mezclar` — así se evita el
    // round-trip de OKLCH y un acento oscuro que no necesita piso queda EXACTO (#8b4513),
    // que es lo que mantiene byte-idénticos los 39 sitios de texto de un acento oscuro.
    let hex = r.a === r.b ? raices[r.a] : mezclar(raices[r.a], raices[r.b], r.w);
    if (r.piso) hex = pisoContraste(hex, fondo, 4.5);
    out[nombre] = hex;
  }
  // acento-txt: el TEXTO sobre el BOTÓN/badge de acento. Es un elemento FIJO (el cliente
  // no lo elige), así que debe ser legible con CUALQUIER acento — auto-flip: BLANCO PURO o
  // tinta, el que más contraste con el acento. Blanco (#ffffff), NO el fondo crema, a
  // propósito: el texto de los botones era `text-white`, así que para Nayoli (acento oscuro
  // → gana el blanco) queda #ffffff EXACTO → byte-idéntico. Para un acento claro (neón →
  // gana la tinta) el botón toma texto oscuro. (§ el gemelo del split de links.)
  out['acento-txt'] = contraste('#ffffff', acento) >= contraste(tinta, acento) ? '#ffffff' : tinta;
  return out;
}
