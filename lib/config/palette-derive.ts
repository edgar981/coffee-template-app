// ─── EL MOTOR DE COLOR DEL STOREFRONT · derivar 24 tintas de 3 RAÍCES ─────────
//
// El cliente elige 3 RAÍCES —fondo · tinta · acento—; las otras 21 tintas del
// storefront (§ globals.css `--sf-*`) se DERIVAN acá. 21 colores no son
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
/** Luminancia relativa WCAG de un hex (0..1). Compartida por `contraste` y por la dirección
 *  del piso: una superficie es "clara" si su luminancia pasa 0.5. */
const luminancia = (hex: string): number => {
  const f = (i: number) => srgbToLin(parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * f(1) + 0.7152 * f(3) + 0.0722 * f(5);
};
/** Contraste WCAG entre dos hex (1..21). */
export function contraste(a: string, b: string): number {
  const l1 = luminancia(a), l2 = luminancia(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
export type DireccionPiso = 'oscurecer' | 'aclarar';
/** La regla de dirección (§ cabecera), vuelta código: superficie CLARA → oscurecer (la regla de
 *  hoy); superficie OSCURA → aclarar. Es el default de `pisoContraste` cuando no se pasa `dir`. */
const direccionDePiso = (bg: string): DireccionPiso => (luminancia(bg) > 0.5 ? 'oscurecer' : 'aclarar');
/** Floréa `hex` (mueve L en OKLCH, hacia oscuro o hacia claro según `dir`) hasta alcanzar
 *  `objetivo:1` de contraste sobre `bg`. El piso de contraste: garantiza que un rol de TEXTO se
 *  lea sobre SU superficie, sea cual sea el acento del cliente (un neón se oscurece a oro legible
 *  sobre fondo claro; un acento oscuro se aclara sobre una superficie oscura).
 *
 *  `dir` es OPCIONAL: si se omite, se DERIVA de la luminancia de `bg` (§ `direccionDePiso`). El
 *  único call site de producción de hoy (`derivarPaleta`, más abajo) no pasa `dir` y su `bg` es
 *  siempre la raíz `fondo` —CLARA en Nayoli—, así que la dirección derivada es 'oscurecer' y el
 *  resultado es BYTE-IDÉNTICO al de antes de este parámetro (afirmado en el test). */
export function pisoContraste(hex: string, bg: string, objetivo = 4.5, dir: DireccionPiso = direccionDePiso(bg)): string {
  let lch = labToLch(hexToOklab(hex)), out = hex;
  const paso = dir === 'oscurecer' ? -0.008 : 0.008;
  for (let i = 0; i < 140 && contraste(out, bg) < objetivo; i++) {
    lch = { ...lch, L: Math.min(1, Math.max(0, lch.L + paso)) };
    out = oklabToHex(lchToLab(lch));
  }
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
 * Deriva las 24 tintas `--sf-*` de las 3 raíces (3 raíces + 18 de la RECETA + `acento-txt` +
 * `tarjeta`/`sobre` — § eje 5b). Devuelve un mapa {nombre → hex} listo para inyectar como CSS
 * vars. Las 3 raíces se copian tal cual; el resto se mezcla; los roles de texto se florean
 * sobre el fondo.
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
  // tarjeta/sobre (§ eje 5b, los 2 tokens nuevos): la superficie de una TARJETA sobre el
  // esquema CREMA/default y su texto/ícono. Hoy son `bg-white`/`text-white` LITERALES en el
  // código —constantes, sin importar el acento del cliente—; acá el motor los deja igual de
  // constantes para el esquema por defecto. `derivarEsquema` los REDERIVA para los otros
  // esquemas (superficie oscura/acento), donde blanco puro ya no es la superficie correcta.
  out['tarjeta'] = '#ffffff';
  out['sobre'] = '#ffffff';
  return out;
}

// ── LOS ESQUEMAS (§ eje 5b) ──────────────────────────────────────────────────
// Un esquema es la superficie sobre la que vive una BANDA de la tienda (una tarjeta, un hero,
// un CTA) — set CERRADO de cuatro. `crema` es el default de hoy; los otros tres cambian la
// superficie base y, con ella, la DIRECCIÓN del piso de contraste de los roles de texto.
export type EsquemaId = 'crema' | 'superficie' | 'oscuro' | 'acento';

// ── TEXTO SOBRE UNA BANDA OSCURA: reusa un candidato CLARO, no re-florea el oscuro ──────────
// Florear `texto`/`texto-suave` (mezclas OSCURAS de acento/tinta, hechas para leerse sobre el
// fondo CLARO de hoy) hasta el piso mínimo sobre una superficie OSCURA da un resultado RASO:
// apenas ~4.5:1, un gris apagado que pasa AA de milagro y no se ve cálido ni de marca — medido
// en el primer intento de este eje, ~4.5–4.6 en los dos esquemas oscuros. Una superficie oscura
// necesita un texto CLARO de entrada, no un oscuro forzado a medio aclarar.
//
// La RECETA ya deriva justo eso, sin color nuevo: `tostado` (el tono cálido y claro del acento
// hacia el fondo, w=0.56) y `tostado-3` (su gemelo más apagado, w=0.24) existen para decoración,
// pero sirven igual como texto sobre una banda oscura — son las MISMAS 3 raíces. `texto` reusa
// `tostado`; si floreado no alcanza un margen cómodo (una superficie MENOS oscura, como el
// acento crudo, deja poco radio antes de tocar blanco), cae a `acento-txt` — el texto YA
// diseñado para el contraste MÁXIMO contra el acento (el auto-flip del botón), que en ese caso
// es la opción cálida-y-clara que sí alcanza. `texto-suave` reusa siempre `tostado-3`, más
// discreto por diseño (el rol "suave"), floreado igual si la superficie lo exige.
//
// Medido contra Nayoli: oscuro (bg tinta) → texto 8.49:1, texto-suave 4.52:1; acento (bg acento)
// → texto 7.10:1, texto-suave 4.51:1 — cálido y con holgura, no raso.
const UMBRAL_CALIDO = 6; // holgura sobre AA (4.5) que separa "cálido de sobra" de "raso"

function textoClaroSobreOscuro(base: PaletaDerivada, superficie: string, dir: DireccionPiso): string {
  const tostadoFl = pisoContraste(base.tostado, superficie, 4.5, dir);
  if (contraste(tostadoFl, superficie) >= UMBRAL_CALIDO) return tostadoFl;
  return pisoContraste(base['acento-txt'], superficie, 4.5, dir);
}

/**
 * Deriva el set de tokens `--sf-*` de UN ESQUEMA, de las MISMAS 3 raíces (cero color nuevo).
 * `crema` es EXACTO al output de `derivarPaleta` de hoy —byte-idéntico, es literalmente el
 * mismo objeto—. Los otros tres reusan `mezclar` y la `RECETA` INTACTAS: lo único que cambia
 * es la SUPERFICIE base (`superficie` → la superficie ya derivada; `oscuro` → la raíz tinta;
 * `acento` → la raíz acento) y, con ella, la dirección del piso —derivada automáticamente por
 * `pisoContraste` de la luminancia de esa superficie (§ `direccionDePiso`)—. `acento-texto` se
 * re-florea de siempre (el rol oscuro, anclado a la NUEVA superficie). `texto`/`texto-suave`
 * se re-florean igual sobre una superficie CLARA (`crema` ya se resolvió arriba; sólo queda
 * `superficie`); sobre una OSCURA (`oscuro`, `acento`) reusan un candidato claro en vez de
 * re-florear el oscuro (§ `textoClaroSobreOscuro`, arriba). `tarjeta`/`sobre` se re-derivan de
 * la superficie del esquema (una tarjeta un ~10% más clara que su banda, con su propio
 * auto-flip de texto).
 *
 * `texto`/`texto-suave` cumplen DOBLE rol, y es a propósito (§ eje 5b, home-2): además del texto
 * DE CUERPO de siempre, son la fuente de `--sf-sobre-banda`/`-suave` (`esquema-style.ts`) — el
 * texto/ícono que se apoya DIRECTO en el fondo de la banda (no en una tarjeta). Sirven para eso
 * SIN cambio: ya están floreados contra `superficie` —la banda MISMA, no la tarjeta (que es
 * ~10% distinta)— y el test de abajo («los 4 esquemas dan texto/texto-suave/acento-texto ≥4.5:1
 * contra su propia superficie») ya lo prueba. `--sf-sobre` NO sirve para ese caso: está floreado
 * contra la TARJETA, y con 'crema' la tarjeta es blanco fijo mientras la banda es clara —1.07:1,
 * medido— así que reusarlo ahí repetiría el hueco que home-2 cierra.
 *
 * La cablea `esquema-style.ts` (§ eje 5b, mitad B y home-2).
 */
export function derivarEsquema(raices: RaicesPaleta, id: EsquemaId): PaletaDerivada {
  const base = derivarPaleta(raices);
  if (id === 'crema') return base;

  const superficie = id === 'superficie' ? base.superficie : id === 'oscuro' ? raices.tinta : raices.acento;
  const dir = direccionDePiso(superficie);
  const out: PaletaDerivada = { ...base, fondo: superficie };
  out['acento-texto'] = pisoContraste(base['acento-texto'], superficie, 4.5, dir);
  if (dir === 'aclarar') {
    out['texto'] = textoClaroSobreOscuro(base, superficie, dir);
    out['texto-suave'] = pisoContraste(base['tostado-3'], superficie, 4.5, dir);
  } else {
    // Superficie CLARA (crema ya salió arriba; sólo queda `superficie`): el mecanismo de
    // siempre — el rol oscuro ya contrasta o se florea un poco más oscuro. Sin cambios.
    out['texto'] = pisoContraste(base['texto'], superficie, 4.5, dir);
    out['texto-suave'] = pisoContraste(base['texto-suave'], superficie, 4.5, dir);
  }
  // tarjeta: la superficie del esquema, ~10% hacia la raíz fondo (una tarjeta más clara que su
  // banda, siempre en dirección a la luz — nunca hacia tinta/acento, que oscurecería más).
  out['tarjeta'] = mezclar(superficie, raices.fondo, 0.10);
  out['sobre'] = contraste('#ffffff', out['tarjeta']) >= contraste(raices.tinta, out['tarjeta']) ? '#ffffff' : raices.tinta;
  return out;
}
