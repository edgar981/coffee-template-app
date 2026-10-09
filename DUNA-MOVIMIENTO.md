
# DUNA-MOVIMIENTO — el vocabulario de movimiento

Hermano de `DUNA-DS.md` (el diseño del panel) y de `docs/movimiento/README.md` (el manual de la
herramienta). Éste es el vocabulario: las palabras que el owner y el orquestador usan para hablar
de una transición SIN describirla, y lo que ya rige en el código para cada una.

## Por qué existe

El owner, el 2026-09-27, sobre lo caro que salió el marquee del hero (tres rondas de gate,
`CORTE-HERO-STICKY-RONDA-2-1` → `CORTE-HERO-MARQUEE-REVELA-1` → `CORTE-HERO-VELO-OFF-Y-TICKER-1`):

> «las transiciones es de las cosas que más ha costado implementar… ¿hay alguna forma de construir
> una base que entienda o analice las páginas de tal forma que me sea fácil explicarte la idea
> cuando pido una transición?»

Las tres rondas tuvieron la MISMA causa de raíz: el movimiento se DESCRIBIÓ con palabras y se leyó
del HTML estático, cuando había que MEDIRLO en ejecución. Un `curl` trae el markup, no lo ejecuta;
una captura de pantalla congela justo lo que importa. `npm run censar:movimiento` (§
`docs/movimiento/README.md`) mide en ejecución — carga la página real, scrollea, y muestrea. Este
documento es el vocabulario que esa medición usa para reportar lo que vio, y que vos podés usar
para pedir lo próximo.

## Las cuatro clases

Un elemento se mueve por una de tres razones (o ninguna, y entonces está quieto). Nunca son
excluyentes: un mismo elemento puede tickear en un eje y scrubear en otro al mismo tiempo — el
marquee del hero de este repo es EXACTAMENTE eso (ver abajo).

### `ticker` — se mueve solo, por TIEMPO

Avanza aunque el visitante no toque el scroll. Un reloj, no un control remoto.

- **En este repo:** el desplazamiento horizontal del marquee del hero bajo el preset CORTE
  (`transformMarquesinaTexto` ya NO se usa ahí; el ticker vive en `VELOCIDAD_TICKER_PX_S` +
  `duracionTickerS`, `lib/animation.ts`, § `CORTE-HERO-VELO-OFF-Y-TICKER-1`) — el texto en loop se
  desliza a una velocidad constante, sin importar dónde está el scroll.
- **Reducido:** un ticker NO tiene, hoy, un gate de `prefers-reduced-motion` propio y explícito más
  allá del que ya cubre `MotionConfig` (§ abajo, "Movimiento reducido") — si el ticker vive dentro
  de un componente `motion.*`, sus valores de TRANSFORM se congelan igual que cualquier otro; si es
  una animación CSS pura (como el `xo-marquee` del tema real, que el arnés SÍ detecta), el gate es
  el `prefers-reduced-motion` nativo de esa CSS, fuera del alcance de `MotionConfig`.

### `scrub` — el visitante lo controla con el dedo

Avanza y retrocede en función de la POSICIÓN de scroll, no del reloj. A scroll fijo, no cambia.

- **En este repo:** `useProgresoScroll`/`useProgresoScrollDesdeTope` (`lib/animation.ts`) son el
  motor — `transformAcomodo` (el acomodo del collage de BrandStory), `transformMarquesinaTarjeta`
  (la tarjeta flotante del marquee), `veloOpacidad` (la densidad del velo del hero) son scrub sobre
  ese progreso.
- **Reducido:** `estatico=true` (el parámetro que TODA función scrub de este repo acepta) rinde el
  estado FINAL del recorrido — nunca el de arranque, y nunca "a medio camino". Es el mismo criterio
  en las tres: `transformAcomodo(...,estatico=true)` da `'none'` (ya acomodado), `veloOpacidad(...,
  estatico=true)` da la densidad final, `transformMarquesinaTarjeta(...,estatico=true)` da la
  tarjeta sin rotar. `estatico` lo decide el llamador: `prefers-reduced-motion` O la vista previa
  del editor de `/admin/tienda` (que no puede scrollear de verdad).

### `revelado` — pasa UNA VEZ, y se queda

Cambia en una ventana angosta del recorrido y después no vuelve a moverse — ni por scroll ni por
tiempo. Puede completarse por scroll (una ventana angosta de posición) o por tiempo dentro de una
misma posición (un contador que sigue contando un rato después de entrar a la vista).

- **En este repo:** `opacidadRevelado`/`translateYRevelado` (`UMBRAL_REVELADO_TEXTO = {desde:0,
  hasta:0.2}`, § `CORTE-HERO-MARQUEE-REVELA-1`) — el texto del marquee entra desde abajo sólo en el
  primer 20% del recorrido pineado, y después queda fijo mientras el resto del scroll mueve otras
  cosas. `useContadorAnimado` (el count-up de la banda Origen, § `ORIGEN-BANDA-1`) es un revelado
  con componente TEMPORAL: dispara al entrar al viewport (`IntersectionObserver` al 40%) y cuenta
  durante `DURACION_CONTADOR_MS` (1100ms) sin que el visitante tenga que seguir scrolleando.
- **Reducido:** un revelado NUNCA puede quedar invisible bajo `prefers-reduced-motion` —
  `opacidadRevelado(...,estatico=true)` da 1 (visible), no 0. El gate apaga el DESPLAZAMIENTO, no el
  CONTENIDO. `useContadorAnimado(...,estatico=true)` salta directo al valor final, sin
  `IntersectionObserver` ni `requestAnimationFrame`.

### `estatico` — no se mueve

No cambió en ninguna muestra. La mayoría de los elementos de cualquier página caen acá — es el
estado por defecto, no una clase que alguien tenga que "activar".

## Un elemento puede ser dos cosas a la vez

El marquee del hero (`HeroMediaMarquesina.tsx`, bajo CORTE) es HOY la prueba viva: el eje HORIZONTAL
del texto es un `ticker` (avanza por tiempo, § arriba) y el eje VERTICAL + la opacidad son un
`revelado` (entran una vez, en el primer 20% del recorrido pineado, § arriba) — DOS motores, en DOS
elementos `motion.*` distintos dentro del mismo componente, nunca un solo `transform` armado a mano
con las dos piezas concatenadas. `censar-movimiento` reporta las dos clases para el mismo elemento,
nunca fuerza una sola — es la forma correcta de leer un elemento así, no una ambigüedad a resolver.

## Lo que ya rige, y hay que poder citar

- **Movimiento reducido, por clase** (§ arriba, cada clase dice el suyo). El mecanismo compartido es
  `ReducedMotionProvider` (`<MotionConfig reducedMotion="user">`, montado una vez en
  `app/(storefront)/layout.tsx`, § `STOREFRONT-REDUCED-MOTION-1`): congela instantáneamente
  cualquier valor de TRANSFORM (x, y, scale, rotate) de un componente `motion.*`, deja seguir
  animando lo que no es transform (opacity, color). NO cubre `staggerChildren`/`delayChildren` (el
  retraso de programación entre hijos sigue existiendo, sólo que cada hijo funde en vez de
  deslizarse) ni nada que no pase por `motion.*` (una transición CSS de Tailwind, un
  `<video autoplay>` — esos llevan su propio gate).
- **El movimiento es un EJE DEL TEMA, no un default global.** Ningún efecto se enciende para todos
  los tenants: lo declara el PRESET (`lib/config/themes.ts`). Ejemplo vivo:
  `NavTratamientoContent.direccion` (el nav que se oculta al bajar y reaparece al subir, §
  `CROMO-NAV-DIRECCION-SCROLL-1`) sólo lo declara CORTE — Nayoli y cualquier otro preset conservan el
  nav de hoy, byte a byte. Un movimiento nuevo se agrega como campo opt-in del preset, nunca como
  cambio de comportamiento del código compartido.
- **Byte-identidad de Nayoli como gate.** Todo cambio de movimiento se verifica contra
  `verificar:nayoli:visual` (diff de píxeles, main vs. rama) — un movimiento nuevo que sólo un
  preset declara no debe mover un solo píxel de Nayoli. Es el gate de CIERRE de cualquier slice de
  movimiento, no de `censar-movimiento` (que NO renderiza nada — mide una URL ya servida, propia o
  de un tercero, y no corre en el gate de un slice que no la necesite).

## Cómo pedir una transición de ahora en más

**URL + elemento → traza (`npm run censar:movimiento -- --url <URL>`) → clase + parámetros (leídos
del `.md`) → spec.** En una frase: en vez de describir el movimiento, señalá la página y el
elemento, corré el censo, y traé la clase (`ticker`/`scrub`/`revelado`) con sus parámetros
(velocidad, ventana de scroll, o desplazamiento y duración) — eso es lo que un spec necesita para
implementar la transición sin adivinar, y es lo que las tres rondas del marquee tuvieron que
reconstruir a mano, una por una, porque nadie lo había medido antes de escribir el spec.

## El marco de movimiento sobre GSAP (§ MOVIMIENTO-MARCO-GSAP-1)

Construido el 2026-10-08, sobre el prototipo aprobado por el owner (`docs/movimiento/
catalogo-movimiento.html` — «Me gustaron todas las animaciones») y el censo `GSAP-MARCO-CENSO-1`
(`docs/movimiento/GSAP-MARCO-CENSO-1.md`, copiado del mismo `.scratch/` que lo produjo).

### Dónde vive cada pieza

- **El registro** — `lib/movimiento/catalogo.ts` (puro, sin DOM, con test en `catalogo.test.ts`).
  Las 19 animaciones del prototipo, cada una con su id (`T01`…, el MISMO del prototipo), su
  `nombre` en palabras llanas, su `nivel` (esencial/editorial/firma), a qué `aplicaA` (texto,
  imagen, tarjetas, cifras, sección, hero), sus `clases` en el vocabulario interno de este mismo
  documento (`ticker`/`scrub`/`revelado`), y si `implementada` (si el motor de abajo la construye
  hoy). `MOVIMIENTO_NINGUNA` (`''`) es «Ninguna» — la ausencia, nunca una entrada del catálogo.
- **El motor** — `components/storefront/movimiento/`: `Movimiento.tsx` (el componente genérico,
  `<Movimiento id="T01" as="h2">…`), `useMovimiento.ts` (el hook: decide SI corre — gates de
  editor/preview, `prefers-reduced-motion`, y si el motor implementa el id — y arma `useGSAP`), y
  `animaciones.ts` (las once funciones ESENCIALES, una por id, traducción directa del `<script>`
  del prototipo). `id` ausente/«Ninguna» no monta NINGÚN nodo propio — devuelve los children tal
  cual, por eso «Ninguna» es byte-idéntico a no usar el componente.
- **El eje por sección** — hoy SÓLO en `secciones-instancias.ts`, tipo `texto` (la demostración de
  este slice: `escalares.animacion`, un escalar clampado al catálogo, igual mecanismo que
  `alineacion`). Sumarlo a las otras ocho instancias y a las bandas del home (`site-content-
  defaults.ts`) es la extensión que necesita exponerlo en el editor — explícitamente deferida, no
  construida en este slice.

### La convivencia con framer-motion — un elemento, una librería

**GSAP es para SCROLL y NARRATIVA; Motion (framer-motion) es para lo que APARECE y DESAPARECE**
(decisión del owner sobre el censo, aceptando su recomendación B — convivencia, no reemplazo total
ni un tercer sistema en paralelo). En la práctica, hoy:

- Los `whileInView`/`useScroll`/`AnimatePresence` de framer-motion que YA existen (`lib/
  animation.ts`, `RevelarBloque.tsx`, `TextoEnCascada.tsx`, el checkout, los drawers) **no se
  tocan** — este slice no migra nada existente, sólo abre el camino para lo nuevo.
- Lo nuevo que declare un eje `animacion` de este catálogo usa el motor de GSAP de este archivo —
  nunca framer-motion para una animación nueva del catálogo, y nunca GSAP para un
  aparece/desaparece de estado de React que framer-motion ya resuelve bien (un modal, un
  `AnimatePresence`).
- **Un mismo elemento nunca lleva las dos.** Si una sección necesita GSAP para su scroll Y Motion
  para un modal propio, son dos NODOS distintos del árbol, cada uno con su librería — nunca el
  mismo nodo animado por las dos a la vez (§ el censo, "convivencia-tercera-clase-sin-bucket-y-
  ausencia-de-doble-driver": es un riesgo de MANTENIMIENTO, no un conflicto técnico real, pero se
  evita igual).

### Cómo se agrega una animación al catálogo

1. Midela contra el prototipo aprobado (`docs/movimiento/catalogo-movimiento.html`) o, si es
   enteramente nueva, contra `npm run censar:movimiento` (para que su CLASE interna sea medida, no
   inventada).
2. Agregá su entrada a `CATALOGO_MOVIMIENTO` (`lib/movimiento/catalogo.ts`) con `implementada:
   false` si todavía no tiene motor — el catálogo puede nombrar una animación antes de construirla.
3. Si la construís, agregá su función a `ANIMACIONES_ESENCIALES` (`components/storefront/
   movimiento/animaciones.ts`) y marcá `implementada: true` — `motorDisponible(id)` es lo único que
   decide si `useMovimiento` la corre; un id `implementada:false` queda visible en el catálogo pero
   el motor nunca la invoca.
4. Verificá SIEMPRE contra `verificar:nayoli:visual` (§ arriba) antes de cerrar — ninguna animación
   nueva, con «Ninguna» como default, debe mover un píxel de Nayoli.
