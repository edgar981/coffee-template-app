
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
- **El eje por sección** — en los NUEVE tipos de `secciones-instancias.ts` desde § MOVIMIENTO-EDITOR-
  EXPOSICION-1 (abajo): `escalares.animacion`, un escalar clampado al catálogo, igual mecanismo que
  `alineacion`, MÁS `animacionElemento` (declara a qué `aplicaA` del catálogo corresponde el ajuste
  de esa sección, para que el editor filtre sus tarjetas). Esta frase describía el estado recién
  nacido de este eje (sólo `texto`, como demostración) — § MOVIMIENTO-EDITOR-EXPOSICION-1 es la
  extensión que esa misma entrada ya anticipaba como pendiente. Las bandas del home
  (`site-content-defaults.ts`) siguen SIN el eje — ver esa sección para el porqué.

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

## El eje llega a las nueve secciones, y al editor (§ MOVIMIENTO-EDITOR-EXPOSICION-1)

Construido el 2026-10-08, siguiendo a MOVIMIENTO-MARCO-GSAP-1 (mismo día). Cierra el follow-up que
esa entrada dejó abierto: el eje `animacion` llega a los nueve tipos de `secciones-instancias.ts`,
cada sección lo aplica de verdad en su render, y el editor lo expone con el selector de tarjetas que
el owner aprobó («Me gustaron todas las animaciones» sobre el prototipo completo).

### El mapeo tipo→elemento, y por qué cada uno es el que es

Cada tipo declara UN `animacionElemento` (`DESCRIPTOR_INSTANCIA[tipo].animacionElemento`) — la clase
del catálogo (`aplicaA`) a la que su ajuste está acotado, y el NODO exacto que el componente real
envuelve con `<Movimiento>`:

| tipo | elemento | nodo que envuelve |
| --- | --- | --- |
| `texto` | texto | el título (h2) — el mismo nodo que ya demostraba `EjemploSeccionTexto.tsx` |
| `imagenTexto` | imagen | la foto |
| `banner` | imagen | la foto de fondo (nada si no hay foto) |
| `preguntas` | tarjetas | el CONTENEDOR de la lista — C01 anima `raiz.children` (cada pregunta), no cada `<button>` por separado |
| `columnas` | tarjetas | el GRID de columnas — mismo criterio |
| `filas` | imagen | DELEGADO: cada fila ya es una `imagenTexto` sintética (§ Filas.tsx, que reusa `SeccionImagenTexto` literal); pasar `instancia.animacion` a cada sintética alcanza, sin segunda implementación |
| `collage` | tarjetas | el GRID EXTERIOR (dos piezas: la grande, la grilla de chicas) — el mosaico encaja entre sí, así que la cascada es de DOS bloques, no foto por foto |
| `video` | imagen | el video de fondo, SÓLO modo `'fondo'` (en `'reproducir'` el video ya tiene su propio gesto de arranque) |
| `carrusel` | texto | la CABECERA opcional (`titulo` de instancia) — un carrusel sólo muestra una diapositiva a la vez, así que «tarjetas escalonadas» no tiene nada coherente que escalonar en las diapositivas; la cabecera sí es texto plano como cualquier título de sección |

`cifras` (N01, el conteo animado) no tiene tipo que lo use hoy — ningún tipo del catálogo modela un
contador numérico. Queda en el catálogo, sin consumidor, como `S01-S03`/`H01-H03`/`CTA01`/`T06`.

### POR QUÉ NO SE WIREÓ NINGUNA BANDA DEL HOME

`touches:` de este slice permitía tocar `site-content-defaults.ts`/`components/storefront/home/`
("y las bandas de la home donde tenga sentido" — el spec, condicional). Medido antes de decidir: las
bandas del home (`HeroMediaMarquesina.tsx`, `Origen.tsx`, `Spotlight.tsx`…) YA llevan movimiento
bespoke propio (ticker/scrub/revelado a medida, documentado arriba en este archivo) — wireear el
catálogo genérico ahí exigiría, para cada banda, decidir qué nodo reemplaza con GSAP sin duplicar o
pelear con el movimiento que ya tiene, un análisis banda-por-banda que el cierre de este slice
("elegir T01 en una sección de texto… I02 en una imagen y C01 en tarjetas") no pide verificar. Se
dejó fuera a propósito — es una extensión real, no una deuda escondida, y su disparador es que el
owner pida animar una banda específica (ahí se mide ESA banda, no las nueve de memoria).

### LA VISTA PREVIA DEL EDITOR — motor real, pero `auto={false}`

El ajuste «Animación» (`SelectorMovimiento.tsx`) es un radiogroup de tarjetas con una miniatura
ILUSTRATIVA en loop (`MiniaturaMovimiento.tsx` + `lib/movimiento/vista-previa.ts`, puro) — **nunca
GSAP real corriendo en una docena de tarjetas a la vez**, mismo criterio que
`SelectorTransicion.tsx` (fuera de `touches:`) ya aplica para las transiciones de la marquesina:
`progresoLoopTarjetaTransicion` (`lib/animation.ts`) reusada tal cual, nunca copiada.

**«Ver animación» (`VistaMovimiento.tsx`) sí usa el motor REAL** (`<Movimiento auto={false}>`), con
un contenido representativo (un párrafo de muestra / una foto de muestra / tres tarjetas de
muestra) — no la sección entera, que sería más superficie de la que esto necesita probar. `auto`
(nuevo en `useMovimiento.ts`) es lo que lo hace posible: con `auto=false` el motor NUNCA se
auto-dispara por scroll —ni siquiera cuando no hay gate de preview/editor, que es justo el caso de
esta vista previa, aislada en su propio documento— y sólo corre al llamar `reproducir()` (el `ref`
imperativo que `Movimiento`/`useMovimiento` exponen). `reproducir()` llama a la MISMA función de
`animaciones.ts` que la página real, con un segundo parámetro `forzar=true` que OMITE el
`scrollTrigger` (así el tween juega inmediato, sin depender de que la cajita de 120px de alto esté
dentro del 82% de un viewport que no tiene sentido ahí) — pero sigue respetando
`prefers-reduced-motion`, igual que el camino automático. Gateado además por
`puedeReproducirUnaVez(id)` (sólo clase `revelado`: I03/parallax y C02/hover no tienen "una vez" que
mostrar — el botón se deshabilita para esos dos, y para «Ninguna»).

**Por qué NO se usó la barra flotante / el iframe de la vista en vivo** (la otra ubicación que el
spec permitía): `VistaTiendaIframe.tsx`/`EditorPuenteVivo.tsx` — el canal postMessage que sincroniza
el borrador con el iframe de la tienda real — están fuera de `touches:` de este slice. Un widget
local, autocontenido, con el motor real pero datos de muestra, cumple "la vista previa queda quieta
y el botón la reproduce una vez" sin tocar esos archivos. La página del editor en SÍ (el iframe que
muestra la sección real con el título/foto verdaderos) también queda quieta automáticamente, GRATIS:
`EditorPuenteVivo` ya monta `ModoEditorProvider(activo=true)`, y el gate 1 de `useMovimiento`
(`!editando`) ya apagaba el motor ahí desde MOVIMIENTO-MARCO-GSAP-1 — nada nuevo que construir para
esa mitad.

### El resumen de publicar nombra la animación

`lib/admin/resumen-cambios.ts` (`cambiosSeccionesHome`): cuando lo ÚNICO que cambió en una instancia
es `animacion`, la fila dice **"Animación de {título}: {nombre de la animación}"** (p. ej.
"Animación de Historia: Aparece por líneas") en vez del genérico "{tipo} · editada" — mismo trato
que la COMPOSICIÓN/los campos con `opciones` en `cambiosDeSeccion` (un escalar que SIEMPRE tiene un
valor es un REEMPLAZO, no un nuevo/quitado). Si ADEMÁS cambia otro campo, se queda con el genérico
—no inventa una frase a medias—, y una instancia NUEVA que ya nace con una animación no usa esta
frase (sigue siendo "nueva").

### Byte-identidad, medida en las NUEVE

`lib/movimiento/demo-byte-identidad.test.ts` generaliza el par ausente/«Ninguna» que
MOVIMIENTO-MARCO-GSAP-1 afirmaba sólo para `texto`, a los nueve tipos — cada uno renderizado con
datos de fixture que ejercitan sus ramas reales (imagen presente, CTA, ítems). El contrato cambió de
dirección a propósito: ese slice afirmaba "elegir una animación real NO mueve un byte" (porque
`Texto.tsx` no leía el campo todavía); éste afirma lo INVERSO para `texto` (ahora SÍ lo lee) y
mantiene "ausente = «Ninguna» explícito" byte-idéntico en los nueve. `verificar:nayoli:visual`
confirma el mismo piso heredado que `MOVIMIENTO-MARCO-GSAP-1`/`NAV-PAGINA-ACTUAL-VISIBLE-1` ya
documentaban (Nayoli no tiene ninguna `seccionesHome` sembrada, así que ninguno de los nueve
componentes tocados se monta en sus páginas reales — el cambio es, por construcción, invisible para
Nayoli).

## El motor espera a que el LAYOUT se asiente antes de medir el umbral (§ MOVIMIENTO-SCROLL-UMBRAL-1)

Cierra el follow-up `MOVIMIENTO-SCROLLTRIGGER-PRE-SCROLL-1` que dejó abierto `MOVIMIENTO-EDITOR-
EXPOSICION-1`: una sección `revelado` muy por debajo del fold (medido: 3417px de scroll, viewport
900px) ya medía `translate:none`/su estado FINAL ANTES de que el visitante bajara un solo píxel —
la animación corría sola, invisible, en vez de esperar el scroll.

**La causa, confirmada con un repro aislado de GSAP/ScrollTrigger SIN React** (sin Postgres ni
Next, `.scratch/repro-scrolltrigger*.html`, no comiteado — reproduce el mecanismo puro de la
librería): `ScrollTrigger` mide `start:'top 82%'` (§ `alEntrar`, `animaciones.ts`) como un píxel
ABSOLUTO contra el documento TAL COMO ESTÁ en el instante en que `useGSAP` lo crea. Si en ese
instante el documento es más CORTO que el real — el storefront sirve el par de fuentes por
`<link>`/`@import`, SIN `next/font` (§ "Las FUENTES son content.tema.fuentePar", arriba), así que
el FOUT reflowea el texto DESPUÉS de montar; verificado en sesión real contra la app completa: el
navegador emitió el warning nativo de GSAP *"SplitText called before fonts loaded"* exactamente en
este caso — ese píxel calculado queda por DEBAJO del scroll actual (típicamente 0, recién cargada
la página) y `ScrollTrigger` evalúa el umbral como YA CRUZADO: reproduce el tween entero de
inmediato. Un `ScrollTrigger.refresh()` posterior NO lo corrige — medido en el mismo repro:
`toggleActions:'play none none none'` no tiene acción de vuelta (`leaveBack:'none'`), así que
refrescar sólo vuelve a medir, nunca deshace un "play" que ya corrió.

**El fix, en `useMovimiento.ts` (único archivo tocado):** un `ResizeObserver` sobre
`document.documentElement`, instalado junto al tween, que ante CUALQUIER cambio de alto del
documento —agnóstico de la CAUSA (fuente, imagen, contenido async)— MATA el tween viejo
(`scrollTrigger.kill()` + `tween.revert()`, que restaura el estilo al de ANTES de animar) y crea
uno NUEVO, que mide el documento como esté EN ESE momento. Se apaga en el PRIMER scroll real
(`window.addEventListener('scroll', …, {once:true})`): el defecto sólo existe ANTES de que el
visitante scrollee un píxel — después, cualquier "play" ya es una reacción a scroll de verdad, y
seguir matando/recreando ahí reabriría un defecto nuevo (un salto visible a mitad de una
reproducción legítima). **Deliberadamente NO es `document.fonts.ready` con timeout**: se midió esa
ruta primero y quedó BLOQUEADA INDEFINIDAMENTE en el arnés (sandbox sin red al CDN de fuentes) —
un timeout corto reintroduce el bug justo en la red lenta que más lo necesita (donde la fuente
tarda más en llegar), y uno largo demora la primera animación de cualquier visita real. El
`ResizeObserver` no depende de red: sólo reacciona si el layout realmente cambió.

**C02** (hover puro, `clases: []`) no crea tween con `scrollTrigger` — el motor lo detecta
(`!tween?.scrollTrigger`) y NO instala el observer: recrear ahí sólo duplicaría los listeners de
`hoverTarjetas` en cada resize, sin nada que corregir (no depende de scroll).

**Verificado en sesión real** (Postgres efímero, `next build`+`next start`, Chromium vía
Playwright, `.scratch/verificar-scroll-umbral.ts`, no comiteado): tres secciones agregadas al home
de Nayoli (Texto+T01, Imagen con texto+I02, Preguntas+C01), publicadas; la ÚLTIMA (T01) aterrizó a
**3417px de scroll** — el mismo número que midió `MOVIMIENTO-EDITOR-EXPOSICION-1` —, y en sesión
pública NUEVA, SIN scrollear: T01 seguía trasladada (`transform≠identidad`), I02 seguía en su
escala de entrada (1.18, no 1), C01 seguía en opacidad 0. Tras `scrollIntoView`, las tres corrieron
y asentaron. **7/7 verificaciones.** Capturas antes/durante/después en `.capturas/scroll-umbral-*.png`.

`verificar:nayoli:visual` reproduce el MISMO piso heredado dígito a dígito (home 165052/174711,
tienda/producto 209/407, checkout 163/361, nosotros 224/422, suscripciones 258/456, los dos hovers
en 0px) — el fix es inerte para Nayoli, igual que el resto del motor (§ arriba, "Nayoli no tiene
ninguna `seccionesHome` sembrada").
