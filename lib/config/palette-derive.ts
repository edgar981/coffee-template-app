// ─── EL MOTOR DE COLOR DEL STOREFRONT · derivar 31 tintas de 3 RAÍCES ─────────
//
// El cliente elige 3 RAÍCES —fondo · tinta · acento—; las otras 28 tintas del
// storefront (§ globals.css `--sf-*`, + los 4 pares de familia de § TEMAS-P6-FAMILIAS-1 +
// `sobre-tinta`/`sobre-acento`/`sobre-acento-2` de § TEMAS-P6-FAMILIAS-2)
// se DERIVAN acá. 28 colores no son configurables; 3 sí. La derivación es una
// mezcla en OKLCH con un peso por token
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
//
// EXTENSIÓN (§ TEMAS-P6-MOTOR-1): "claro pisa a oscuro, oscuro pisa a claro" asumía que toda
// superficie de texto era CLARAMENTE una u otra. Pero `acento-texto`/`acento-txt` pisan contra
// una superficie de LUMINANCIA MEDIA (el propio acento del cliente) — y ahí el umbral de 0.5 elige
// la dirección EQUIVOCADA: para un acento de luminancia 0.31 (medido, `#d98324`), aclarar (la regla
// vieja) da 2.91:1 sobre su propio fondo; oscurecer da 6.95:1. La dirección correcta NO es "¿la
// superficie es clara?" sino "¿qué dirección alcanza MÁS contraste?" — que es lo que
// `direccionDePiso` prueba ahora (comparando blanco puro vs negro puro contra la superficie). El
// cruce real está en L≈0.1791 (demostrado algebraicamente, no 0.5): para CUALQUIER luminancia de
// fondo el mejor de blanco/negro puro da ≥4.58:1 — nunca menos, así que el piso de 4.5 siempre es
// alcanzable en la dirección correcta. El espíritu de la regla no cambia (texto flota contra LA
// SUPERFICIE QUE LO SOSTIENE); lo que cambia es que "clara u oscura" se decide por ALCANCE REAL, no
// por un umbral crudo.

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
/** La regla de dirección (§ TEMAS-P6-MOTOR-1): NO un umbral crudo de luminancia — la dirección
 *  que MÁS CONTRASTE alcanza sobre `bg`, probando las dos (blanco puro vs negro puro) y
 *  quedándose con la que gana. Es el default de `pisoContraste` cuando no se pasa `dir`.
 *
 *  El umbral viejo (`luminancia(bg) > 0.5`) coincide con éste para toda superficie CLARA (>0.5) u
 *  OSCURA (<0.1791) — donde las dos reglas concuerdan, así que Nayoli/NEON quedan byte-idénticos—,
 *  pero DIVERGE en la banda intermedia (0.1791, 0.5): ahí el umbral viejo elegía "aclarar" para
 *  TODA luminancia bajo 0.5, cuando el cruce real (blanco==negro en contraste WCAG) está en
 *  L≈0.1791, no en 0.5. Un acento de luminancia 0.31 (medido, `#d98324`) caía en esa banda y
 *  "aclarar" le daba 2.91:1 sobre sí mismo — la dirección que MENOS alcanza. */
const direccionDePiso = (bg: string): DireccionPiso =>
  contraste('#000000', bg) >= contraste('#ffffff', bg) ? 'oscurecer' : 'aclarar';
/** Floréa `hex` (mueve L en OKLCH, hacia oscuro o hacia claro según `dir`) hasta alcanzar
 *  `objetivo:1` de contraste sobre `bg`. El piso de contraste: garantiza que un rol de TEXTO se
 *  lea sobre SU superficie, sea cual sea el acento del cliente (un neón se oscurece a oro legible
 *  sobre fondo claro; un acento oscuro se aclara sobre una superficie oscura).
 *
 *  `dir` es OPCIONAL: si se omite, se DERIVA por alcance real de la luminancia de `bg`
 *  (§ `direccionDePiso`). El call site de `derivarPaleta` no pasa `dir` y su `bg` es siempre la
 *  raíz `fondo` —CLARA en Nayoli—, así que la dirección derivada sigue siendo 'oscurecer' y el
 *  resultado es BYTE-IDÉNTICO al de antes de este parámetro (afirmado en el test).
 *
 *  LA ESCALERA (§ TEMAS-P6-MOTOR-1), en orden — cada paso sólo corre si el anterior no alcanzó:
 *   1. caminar L (el mecanismo de siempre, sin cambios);
 *   2. si L llegó a su extremo (0 o 1) sin alcanzar el objetivo, bajar CROMA conservando el TONO
 *      —un tono muy saturado puede quedar corto de contraste aun en el extremo de L: `CORTE` con
 *      L=1 y C=0.0995 (paso 1 solo) da 4.08:1, pero el mismo L con C=0 (blanco puro) da 4.73:1—;
 *   3. si aún no alcanza, el extremo PURO de esta dirección (#000000/#ffffff exacto) es el mejor
 *      esfuerzo posible SIN CAMBIAR DE DIRECCIÓN — `dir` se respeta siempre, incluso forzado
 *      (el test "dir explícito SE RESPETA" lo exige); los pasos 1+2 ya convergen ahí salvo
 *      redondeo de punto flotante, así que este paso es la red, no el mecanismo principal.
 *
 *  GARANTÍA (demostrada algebraicamente, no sólo medida): para CUALQUIER luminancia de fondo en
 *  [0,1], max(contraste con blanco puro, contraste con negro puro) ≥ 4.5826 — el peor caso posible,
 *  en el cruce L≈0.1791 — así que con `dir` AUTO-DERIVADO (sin forzar) `pisoContraste` SIEMPRE
 *  alcanza objetivo=4.5, para cualquier candidato y cualquier `bg`. Con `dir` forzado a la
 *  dirección que NO gana, el paso 3 puede devolver por debajo del objetivo — es física del
 *  contraste, no un bug (§ el test de arriba). */
export function pisoContraste(hex: string, bg: string, objetivo = 4.5, dir: DireccionPiso = direccionDePiso(bg)): string {
  let lch = labToLch(hexToOklab(hex)), out = hex;
  const signo = dir === 'oscurecer' ? -1 : 1;
  // 1) caminar L.
  for (let i = 0; i < 140 && contraste(out, bg) < objetivo; i++) {
    lch = { ...lch, L: Math.min(1, Math.max(0, lch.L + signo * 0.008)) };
    out = oklabToHex(lchToLab(lch));
  }
  // 2) bajar croma conservando el tono, desde donde L quedó.
  if (contraste(out, bg) < objetivo && lch.C > 0) {
    const pasoC = lch.C / 140;
    for (let i = 0; i < 140 && contraste(out, bg) < objetivo && lch.C > 0; i++) {
      lch = { ...lch, C: Math.max(0, lch.C - pasoC) };
      out = oklabToHex(lchToLab(lch));
    }
  }
  // 3) el extremo puro de ESTA dirección, como mejor esfuerzo final.
  if (contraste(out, bg) < objetivo) out = dir === 'oscurecer' ? '#000000' : '#ffffff';
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
 * Deriva las 31 tintas `--sf-*` de las 3 raíces (3 raíces + 18 de la RECETA + `acento-txt` +
 * `tarjeta`/`sobre` — § eje 5b — + `sobre-superficie`/`-suave` + `sobre-tarjeta`/`-suave` —
 * § TEMAS-P6-FAMILIAS-1 — + `sobre-tinta` + `sobre-acento`/`sobre-acento-2` — § TEMAS-P6-FAMILIAS-2).
 * Devuelve un mapa {nombre → hex} listo para inyectar como CSS vars. Las 3 raíces se copian tal
 * cual; el resto se mezcla; los roles de texto se florean sobre el fondo (o, para los pares
 * nuevos, sobre SU PROPIA superficie — § el comentario de cada uno, abajo).
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
  // sobre-superficie / sobre-superficie-suave (§ TEMAS-P6-FAMILIAS-1): el PAR de la familia
  // `superficie` — texto DIRECTO sobre `--sf-superficie` (el fondo de paneles/pills, p.ej.
  // ProductChip, la píldora de notas de ProductCard). `superficie` es RAÍZ (RECETA, `a:'fondo'
  // b:'acento' w:0.09`) y NINGÚN esquema la re-deriva (§ esquemaStyle no la toca), así que su par
  // vive ACÁ y no en esquema-style.ts — es la respuesta a "raíz vs banda" del spec.
  //
  // Reusa los MISMOS candidatos que `texto`/`texto-suave` (mezcla acento/tinta a los mismos pesos,
  // 0.34/0.12), pero floreados contra LA SUPERFICIE, no contra `fondo`: floreado-contra-fondo NO
  // basta — medido, MEDIO da 4.19:1 con `texto` sobre `superficie` (bajo AA) porque `superficie`
  // se mezcla un 9% hacia el acento y su luminancia puede diferir de la de `fondo` lo suficiente
  // para cruzar el piso de 4.5 sin que nadie lo note (§ el test de regresión, que fija el defecto
  // viejo con NAYOLI/MEDIO antes de este par).
  //
  // SIN default en `globals.css` a propósito (mismo patrón que `--sf-sobre-banda`): sólo lo
  // inyecta `cssPaleta` para un cliente con raíces CUSTOM (itera todas las claves de este objeto);
  // Nayoli (raíces null) no dispara esa inyección, así que sus consumidores traen su propio
  // fallback al token de hoy (`var(--sf-sobre-superficie,var(--sf-tinta))`) y quedan intactos.
  out['sobre-superficie'] = pisoContraste(mezclar(acento, tinta, 0.34), out.superficie, 4.5);
  out['sobre-superficie-suave'] = pisoContraste(mezclar(acento, tinta, 0.12), out.superficie, 4.5);
  // sobre-tinta (§ TEMAS-P6-FAMILIAS-2): el TEXTO/ícono que se apoya DIRECTO sobre `--sf-tinta`
  // como SUPERFICIE (el wordmark y el cherry del mark en el footer, `bg-[var(--sf-tinta)]`).
  // `tinta` es RAÍZ y NINGÚN esquema la re-deriva, así que su par vive ACÁ y no en
  // esquema-style.ts — mismo criterio que `sobre-superficie`, arriba.
  //
  // El defecto medido: `Logo.tsx` leía `--sf-fondo` CRUDO como texto sobre `tinta` en el footer —
  // 1,085:1 en VETA (fondo y tinta caen del mismo lado de luminancia, casi idénticos; el `fondo`
  // de un cliente NO está garantizado a ser "el opuesto claro" de su `tinta`). Auto-flip
  // blanco/fondo (el candidato natural de texto CLARO) GANA PISO (§ TEMAS-P6-MOTOR-1) contra
  // `tinta`: 20,22:1 en VETA, sin empeorar ninguna de las otras paletas medidas. Para Nayoli
  // (fondo ya casi blanco) el candidato ya gana con blanco puro y el piso no lo toca.
  //
  // SIN "-suave": un solo peso consume este token hoy (wordmark y cherry son la MISMA jerarquía
  // visual, no principal/secundaria) — agregar el gemelo sin consumidor sería la mina inerte que
  // el código muerto ya le costó a este repo (CLAUDE.md, ex-#68). SIN default en `globals.css`
  // (mismo patrón que `sobre-superficie`): el consumidor trae su propio fallback al token de hoy
  // (`var(--sf-sobre-tinta,var(--sf-fondo))`), así que Nayoli (raíces null → sin inyección) queda
  // byte-idéntico.
  out['sobre-tinta'] = pisoContraste(
    contraste('#ffffff', tinta) >= contraste(fondo, tinta) ? '#ffffff' : fondo,
    tinta,
    4.5,
  );
  // acento-txt: el TEXTO sobre el BOTÓN/badge de acento. Es un elemento FIJO (el cliente
  // no lo elige), así que debe ser legible con CUALQUIER acento — auto-flip: BLANCO PURO o
  // tinta, el que más contraste con el acento. Blanco (#ffffff), NO el fondo crema, a
  // propósito: el texto de los botones era `text-white`, así que para Nayoli (acento oscuro
  // → gana el blanco) queda #ffffff EXACTO → byte-idéntico. Para un acento claro (neón →
  // gana la tinta) el botón toma texto oscuro. (§ el gemelo del split de links.)
  //
  // GANA PISO (§ TEMAS-P6-MOTOR-1): el auto-flip era un pick BINARIO sin garantía — devolvía
  // el "perdedor menos malo" cuando NINGUNO de los dos candidatos alcanzaba 4.5 (medido: acento
  // de PATIO, `#c8662b`, el pick daba la tinta a 4.238:1, bajo el piso, sin florear más). Ahora
  // el candidato ganador pasa por el MISMO mecanismo que el resto de los roles de texto —
  // `pisoContraste` contra el acento (la superficie real del botón), nunca contra `fondo`. Para
  // Nayoli el candidato ya pasa (7.10:1) y el piso no lo toca → byte-idéntico.
  const candidatoAcentoTxt = contraste('#ffffff', acento) >= contraste(tinta, acento) ? '#ffffff' : tinta;
  out['acento-txt'] = pisoContraste(candidatoAcentoTxt, acento, 4.5);
  // sobre-acento / sobre-acento-2 (§ TEMAS-P6-FAMILIAS-2): el texto del NOMBRE de un plan de
  // suscripción sobre SU tarjeta — floreado CONTRA LA SUPERFICIE que esa tarjeta realmente pinta
  // (`acento` en la destacada, `acento-2` en las demás), no contra un token decorativo ajeno. El
  // defecto medido: `SubscriptionCTA` leía `--sf-tostado` (decorativo, sin piso alguno) en las DOS
  // tarjetas — 3,135:1 sobre `acento` y 1,378:1 sobre `acento-2` (VETA/MEDIO), las dos bajo AA.
  //
  // `sobre-acento` NO es `acento-txt` con otro nombre por capricho: es EL MISMO VALOR
  // (`acento-txt` YA GANA PISO contra `acento`, arriba) bajo un nombre SIN default en
  // `globals.css` — mismo motivo que `sobre-tarjeta` frente a `sobre` (§ TEMAS-P6-FAMILIAS-1):
  // `--sf-acento-txt` tiene default de raíz (`#ffffff`), así que un `var(--sf-acento-txt,
  // fallback)` nunca cae al fallback, y leerlo DIRECTO habría cambiado el color HOY-visible de
  // Nayoli en esta tarjeta (tostado, 3,135:1 — un defecto propio, medido, pero es el de
  // TEMAS-P6-NAYOLI-FIX, no el de este slice; § LA PROMESA QUE NO SE ROMPE).
  //
  // `sobre-acento-2` reusa el MISMO mecanismo (auto-flip blanco/tinta, GANA PISO) pero evaluado
  // contra `acento-2` — medido: reusar `acento-txt` tal cual (floreado contra `acento`) da sólo
  // 1,609:1 contra `acento-2`, sigue fallando; el auto-flip evaluado contra la superficie
  // CORRECTA da 12,567:1 en VETA/MEDIO.
  //
  // Las dos SIN default en `globals.css`: los consumidores traen su propio fallback a
  // `--sf-tostado` (`var(--sf-sobre-acento,var(--sf-tostado))` / `var(--sf-sobre-acento-2,
  // var(--sf-tostado))`), así que Nayoli queda byte-idéntico.
  out['sobre-acento'] = out['acento-txt'];
  const candidatoAcento2Txt = contraste('#ffffff', out['acento-2']) >= contraste(tinta, out['acento-2']) ? '#ffffff' : tinta;
  out['sobre-acento-2'] = pisoContraste(candidatoAcento2Txt, out['acento-2'], 4.5);
  // tarjeta/sobre (§ eje 5b, los 2 tokens nuevos): la superficie de una TARJETA sobre el
  // esquema CREMA/default y su texto/ícono. Hoy son `bg-white`/`text-white` LITERALES en el
  // código —constantes, sin importar el acento del cliente—; acá el motor los deja igual de
  // constantes para el esquema por defecto. `derivarEsquema` los REDERIVA para los otros
  // esquemas (superficie oscura/acento), donde blanco puro ya no es la superficie correcta.
  out['tarjeta'] = '#ffffff';
  out['sobre'] = '#ffffff';
  // sobre-tarjeta/sobre-tarjeta-suave (§ TEMAS-P6-FAMILIAS-1): ver `sobreTarjetaDe` arriba para el
  // porqué NO es `--sf-sobre`. Para NAYOLI, `sobreTarjetaDe('#ffffff', '#1a0f08')` da la tinta EXACTA
  // (contraste 1:1 del blanco pierde contra la tinta, y la tinta ya pasa el piso sin florear más) —
  // byte-idéntico al `--sf-tinta` que ProductCard lee hoy. `sobre-tarjeta-suave` reusa `acento-texto`
  // (ya floreado contra `fondo`, YA ≥4.5 para Nayoli) y lo re-florea contra la tarjeta blanca — no-op
  // para Nayoli, byte-idéntico al `--sf-acento-texto` de hoy.
  out['sobre-tarjeta'] = sobreTarjetaDe(out['tarjeta'], tinta);
  out['sobre-tarjeta-suave'] = pisoContraste(out['acento-texto'], out['tarjeta'], 4.5);
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
 * El texto PRINCIPAL de la familia `tarjeta` — auto-flip blanco/tinta (el que más contraste
 * alcance sobre `tarjeta`) GANA PISO (mismo patrón "gana piso" de `acento-txt`, § TEMAS-P6-MOTOR-1,
 * aplicado a la tarjeta en vez del acento): garantizado ≥4.5 para cualquier `tarjeta`/`tinta`.
 *
 * NO es `--sf-sobre`. Ese token YA EXISTE con OTRO significado en el resto del storefront — texto
 * sobre TINTA (footer, botones del carrito/checkout, el nav flotante) — y su default de `:root`
 * (`#ffffff`) es correcto para ESE rol, no para el de "texto dentro de una tarjeta". Reusarlo acá
 * habría heredado además su degeneración en 'crema': con `tarjeta` blanca fija, el auto-flip de
 * `derivarPaleta` para `sobre` está HARDCODEADO a `#ffffff` (byte-idéntico al `text-white` que
 * nadie más lee, § el comentario de `out['sobre']` abajo) — blanco sobre blanco, 1:1, medido. Un
 * nombre nuevo, SIN default en `globals.css` (mismo patrón que `--sf-sobre-banda`), evita las dos
 * trampas: los 4 consumidores de esta pasada leen `var(--sf-sobre-tarjeta,var(--sf-tinta))`, así
 * que SIN esquema asignado —el caso real de Nayoli en /tienda, /suscripciones y el home mientras
 * nadie asigne un esquema— cae exactamente al texto de hoy (cero cambio visual), y CON esquema
 * asignado se florea de verdad contra LA TARJETA de ese esquema.
 */
function sobreTarjetaDe(tarjeta: string, tinta: string): string {
  const candidato = contraste('#ffffff', tarjeta) >= contraste(tinta, tarjeta) ? '#ffffff' : tinta;
  return pisoContraste(candidato, tarjeta, 4.5);
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
 * `superficie`); sobre una OSCURA (`oscuro`, siempre; `acento` sólo si el acento del cliente es
 * de verdad oscuro, § TEMAS-P6-MOTOR-1 — `dir` decide por ALCANCE REAL, no por el id del esquema)
 * reusan un candidato claro en vez de re-florear el oscuro (§ `textoClaroSobreOscuro`, arriba).
 * Un acento de luminancia MEDIA (ni claramente claro ni oscuro, p.ej. `#c8662b`) puede caer del
 * lado CLARO (`dir === 'oscurecer'`) pese a llamarse esquema "acento": es correcto, porque ahí es
 * donde el texto oscuro sí alcanza más contraste que uno claro. `tarjeta`/`sobre` se re-derivan de
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
  // sobre-tarjeta/sobre-tarjeta-suave (§ TEMAS-P6-FAMILIAS-1): a diferencia de `sobre` (arriba,
  // auto-flip SIN piso — pasa hoy para los 4 esquemas × {NAYOLI,NEON,MEDIO} por coincidencia, pero
  // sin garantía), `sobre-tarjeta` pasa por `sobreTarjetaDe` (GANA PISO, § arriba): garantizado
  // ≥4.5 para cualquier acento/tinta del cliente. `sobre-tarjeta-suave` re-florea `acento-texto`
  // —que en esta rama ya está floreado contra la BANDA (`superficie`, arriba)— contra la TARJETA
  // específicamente: es el hueco medido (§2.1) — floreado-contra-banda no basta cuando se lee
  // sobre la tarjeta (10% distinta), NAYOLI daba 1.249:1 en 'acento' antes de este re-floreo.
  out['sobre-tarjeta'] = sobreTarjetaDe(out['tarjeta'], raices.tinta);
  out['sobre-tarjeta-suave'] = pisoContraste(out['acento-texto'], out['tarjeta'], 4.5);
  return out;
}
