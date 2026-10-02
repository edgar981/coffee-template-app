// § MARQUESINA-TARJETA-PRODUCTO-1 (2026-10-02) — el MODO de la tarjeta flotante de
// `HeroMediaMarquesina.tsx` ("LA TARJETA", § su docstring de cabecera). AMPLIADO por
// § MARQUESINA-TARJETA-SECUENCIA-1 (mismo día): `tamanoSiCompleta`, más abajo, cierra el parpadeo
// entre recargas que dejaba el modo medido inconsistente.
//
// EL TILE DE HOY ES EL DEL PROTOTIPO DE CAFEONE, VERBATIM (`.marquee-card`,
// `docs/prototipos/cafeone/css/app.css:424-431`): caja `aspect-[3/4]` con fondo propio
// (`--sf-tarjeta`) y padding, foto `object-contain` centrada adentro. Esa forma asume que la foto
// NO llena la caja — una silueta recortada sobre fondo transparente, el caso para el que `contain`
// existe. Cuando la foto YA trae su PROPIO fondo de estudio (generada, casi siempre 3:4), el
// padding deja ver un ANILLO del color del tile alrededor del color de la foto: el "marco" que el
// owner no quiere. Es el MISMO defecto, con la MISMA causa, que ya se midió y cerró para el
// destacado y el riel de productos (§ FOTOS-SIN-BORDE-LINEA-NAV-FLECHAS-PDP-1, DECISIONS.md,
// 2026-09-30): "la premisa que justificaba `contain` —una foto cuya proporción real no sea
// exactamente 3:4— ya no aplica: las fotos son 3:4, la MISMA proporción del tile".
//
// ACÁ LA REGLA NO PUEDE SER INCONDICIONAL COMO ALLÁ. El destacado y el riel muestran SIEMPRE
// productos del catálogo con fotos generadas a propósito para ese tile; esta tarjeta muestra
// CUALQUIER producto que el operador apunte con `marquesina.productoSlug` — la MISMA portada que
// ese producto ya usa en el catálogo, el PDP y el carrito (`imagenPortada(producto.imagen)`), no
// una foto dedicada a este slot. No hay garantía de que esa portada sea 3:4; el operador puede
// cambiar el producto apuntado en cualquier momento. Por eso la regla se DERIVA de la proporción
// REAL de la foto, no se asume: 'completa' (borde a borde, sin padding, `object-cover`) cuando la
// foto coincide con la proporción del tile —ahí `cover` no recorta nada porque no hay nada que
// recortar—; 'tile' (el prototipo, con su padding y su fondo) en cualquier otro caso, porque
// `object-contain` JAMÁS recorta, sea cual sea la proporción real.
export type ModoTarjetaMarquesina = 'completa' | 'tile';

/** La proporción del tile — `aspect-[3/4]` en `HeroMediaMarquesina.tsx`, la MISMA de `.marquee-card`. */
export const ASPECTO_TARJETA_MARQUESINA = 3 / 4;

/**
 * Tolerancia de la comparación, en fracción del aspecto (no en píxeles): una foto generada a 3:4
 * puede llegar con un redondeo de un par de píxeles (1500×2000 vs 1500×1999, p. ej.) y sigue siendo,
 * a todo efecto visual, 3:4. 2% deja pasar ese redondeo sin dejar pasar una foto de otra FORMA
 * (1:1 difiere ~33%; 4:3, el apaisado, ~78%) — las dos distancias de la tabla de abajo son órdenes
 * de magnitud mayores que el margen de redondeo que esto existe para tolerar.
 */
export const TOLERANCIA_ASPECTO_TARJETA_MARQUESINA = 0.02;

/**
 * Decide cómo mostrar la foto DENTRO del tile `aspect-[3/4]`, a partir de su proporción REAL —
 * medida en el navegador (`naturalWidth`/`naturalHeight` del `<img>` ya decodificado, § el
 * `onLoad` de `HeroMediaMarquesina.tsx`), nunca asumida. `undefined`/`0`/negativo (todavía no se
 * terminó de medir, o la medición no tiene sentido) cae a `'tile'` — el modo que NUNCA recorta, así
 * que es el default SEGURO mientras no hay dato: es exactamente el mismo tile que el componente ya
 * rendía antes de este slice, byte-idéntico hasta que la medición llega.
 */
export function modoTarjetaMarquesina(
  anchoImagen: number | undefined,
  altoImagen: number | undefined,
): ModoTarjetaMarquesina {
  if (!anchoImagen || !altoImagen || anchoImagen <= 0 || altoImagen <= 0) return 'tile';
  const aspecto = anchoImagen / altoImagen;
  const delta = Math.abs(aspecto - ASPECTO_TARJETA_MARQUESINA) / ASPECTO_TARJETA_MARQUESINA;
  return delta <= TOLERANCIA_ASPECTO_TARJETA_MARQUESINA ? 'completa' : 'tile';
}

// ── EL PARPADEO ENTRE RECARGAS — § MARQUESINA-TARJETA-SECUENCIA-1 (2026-10-02) ───────────────────
//
// EL DEFECTO REPORTADO POR EL OWNER, LITERAL, sobre Café Las Chamisas: «Hay otro bug con la imagen
// del producto en el hero, si refresco sale con los bordes, si vuelvo y refresco sale la otra, se
// cambian en cada refresh». `HeroMediaMarquesina.tsx` medía la proporción SÓLO en el `onLoad` del
// `<Image>` (§ MARQUESINA-TARJETA-PRODUCTO-1): si ese evento NUNCA llega a dispararse para React en
// una carga dada —el modo de falla exacto que un `onLoad` de imagen tiene cuando el navegador
// resuelve la carga por su cuenta antes de que el componente la pueda observar—, `tamanoImagenTarjeta`
// se queda en `null` para TODA la sesión y `modoTarjetaMarquesina` cae a `'tile'` (el default SEGURO,
// nunca recorta) en vez de a `'completa'`. Como esto depende de timing del navegador y no de nada
// que el código controle, el resultado varía de una carga a la siguiente — el "a veces sí, a veces
// no" reportado.
//
// `tamanoSiCompleta` CIERRA EL HUECO LEYENDO `.complete` DIRECTO DEL ELEMENTO, no esperando a que
// React vea un evento: una imagen `HTMLImageElement` expone `.complete` (y, si `complete` es true,
// `naturalWidth`/`naturalHeight` ya resueltos) en CUALQUIER momento, haya o no un listener de
// `onLoad` enganchado a tiempo. El componente la llama DOS veces: (1) en un efecto que corre justo
// tras montar (o tras cambiar de producto) — si la imagen YA estaba completa para entonces (el caso
// cacheado), la mide ahí mismo, sin esperar nada; (2) sigue dejando el `onLoad` normal para el caso
// en que la imagen TODAVÍA esté cargando en ese instante — ahí sí llega el evento real, porque la
// imagen recién montada por React no tiene forma de haber terminado de cargar ANTES de que el
// handler se enganche. Las dos vías escriben el MISMO estado; cuál de las dos gana es sólo cuestión
// de timing, nunca de cuál mida "mejor".
//
// POR QUÉ ESTO NO PINTA UN MODO PARA LUEGO CAMBIAR AL OTRO: la tarjeta entera nace a OPACIDAD 0
// (`opacidadEntradaTarjetaMarquesina`, `lib/animation.ts` — la "aparición" que le dio
// MARQUESINA-TARJETA-PRODUCTO-1) y no empieza a aparecer hasta que el visitante scrollea dentro de
// `UMBRAL_ENTRADA_TARJETA_MARQUESINA`. La medición-al-montar corre ANTES de que exista ese scroll
// (es parte del primer render, no de una interacción del visitante), así que para el caso cacheado
// —el que la prueba de diez recargas seguidas ejercita— el modo queda resuelto desde el primer
// frame, a opacidad 0: no hay nada que "cambiar de modo" porque nunca llegó a pintarse en el modo
// equivocado mientras era visible.
export interface ImagenCargable {
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
}

/**
 * Lee el tamaño de una imagen que YA terminó de cargar (`.complete`), sin depender de que React
 * haya visto su evento `onLoad`. `null` si todavía no hay nada que leer (imagen ausente, o
 * `.complete` falso — sigue cargando) o si lo que hay es basura (dimensión ≤0, la misma guarda que
 * ya aplica `modoTarjetaMarquesina`).
 */
export function tamanoSiCompleta(img: ImagenCargable | null | undefined): { w: number; h: number } | null {
  if (!img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return null;
  return { w: img.naturalWidth, h: img.naturalHeight };
}

// EL ANCHO REAL DEL TILE NO ES UN VALOR PLANO — `w-[min(340px,62vw)]` (`HeroMediaMarquesina.tsx`):
// 340px fijo desde el viewport donde `62vw` ya lo supera, `62vw` por debajo de ese punto. El punto
// de corte es el viewport donde `62vw` vale exactamente 340px: `vw = 340/0.62 ≈ 548.39px`. El
// `sizes="340px"` de antes era un valor PLANO que pedía el ancho del TECHO para TODO viewport,
// incluidos los móviles angostos donde el tile real mide menos — no desenfoca (pide de más, nunca
// de menos) pero descarga bytes de más de los que el DPR del dispositivo necesita: el DPR en sí lo
// resuelve el navegador combinando ESTE `sizes` con el `srcset` de anchos que `next/image` ya
// genera, no hace falta una cuenta aparte para eso.
export const SIZES_TARJETA_MARQUESINA = '(min-width: 549px) 340px, 62vw';
