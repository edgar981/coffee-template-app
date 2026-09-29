// lib/storefront/pdp-galeria.ts — § HERO-SIN-TARJETA-Y-PDP-IMAGEN-1 (defecto 2)
//
// EL DEFECTO REPORTADO: en /tienda/[slug], la imagen principal cargaba (el navegador la descargaba
// y la decodificaba — `naturalWidth` > 0) pero su CONTENEDOR quedaba en `opacity: 0` computada
// varios segundos después. `app/(storefront)/tienda/[slug]/page.tsx` envuelve esa imagen en un
// `motion.div` con `initial={{opacity:0}}` → `animate={{opacity:1}}`: la revelación depende de que
// framer-motion EJECUTE esa animación tras montar. Reproducido extensamente contra el muestrario
// desplegado (carga normal, cambio de miniatura, navegación client-side entre PDPs preservando
// estado, CPU/red muy throttled + `prefers-reduced-motion`, clics en ráfaga) SIN lograr que quede
// atascada — pero el mecanismo en sí es el ANTIPATRÓN conocido para contenido `priority`/LCP:
// gatear la visibilidad de la imagen más importante de la página detrás de un ciclo de vida de JS
// (mount → efecto → animación) es exactamente la clase de bug que puede fallar en un dispositivo
// lento o con JS retrasado sin que ningún test automatizado rápido lo vea (el mismo modo de falla
// documentado en HeroMediaMarquesina.tsx para `whileInView` en la vista previa: "NO queda invisible
// esperando" — ahí ya se usa `initial={false}` para que el PRIMER render no dependa del cliente).
//
// EL FIX: la imagen PRINCIPAL (la que se ve al entrar a la página, antes de que el visitante haya
// tocado una miniatura) usa `initial={false}` — framer-motion renderiza DIRECTO en el estado
// `animate` (opacity:1), sin ninguna animación que pueda no completar. Una vez que el visitante
// interactúa con la galería (clic en una miniatura), el fade SÍ se anima entre imágenes — para ese
// punto la interacción ya demuestra que JS está corriendo, así que no hay riesgo de "imagen
// invisible sin que nada la revele".
//
// `entradaHeroInicial` es la única pieza PURA y por tanto afirmable sin navegador — la decisión de
// qué le pasa a framer-motion, no la animación en sí (que sigue siendo capa 3, igual que el resto
// de las animaciones scroll/mount de este repo).

/**
 * El valor del prop `initial` del `motion.div` que envuelve la imagen principal del detalle de
 * producto. `false` (nunca animar, arrancar YA en el estado `animate`) mientras el visitante no
 * haya tocado ninguna miniatura — la imagen con la que llega a la página nunca debe depender de que
 * una animación de JS complete para hacerse visible. `{ opacity: 0 }` (el fade normal) una vez que
 * SÍ interactuó: en ese punto cambiar de imagen es una respuesta a un clic, no la carga inicial.
 */
export function entradaHeroInicial(galeriaTocada: boolean): false | { opacity: number } {
  return galeriaTocada ? { opacity: 0 } : false;
}

/**
 * La imagen que ocupa el hero del detalle, dado el índice elegido por el visitante. `imgIdx` puede
 * quedar fuera de rango (un producto nuevo con menos imágenes que el índice que el visitante había
 * dejado en el anterior, vía navegación client-side entre productos — el estado de la página no se
 * resetea solo) — por eso cae a la portada (`galeria[0]`), nunca a `undefined`.
 */
export function heroDeGaleria(galeria: readonly string[], imgIdx: number): string | undefined {
  return galeria[imgIdx] ?? galeria[0];
}
