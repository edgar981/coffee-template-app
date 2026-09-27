# El arnés de censo de movimiento

`npm run censar:movimiento -- --url <URL> [--nombre <slug>] [...]` — herramienta del arnés (no de
diseño): carga cualquier página con Playwright, muestrea el `transform`/`opacity` computado de sus
elementos a lo largo del SCROLL y del TIEMPO, y clasifica cada elemento que se mueve. El resto de
esta carpeta (`*.md`/`*.json`) son trazas de corridas concretas, citables por fecha y URL.

**Por qué existe** y **el vocabulario de movimiento** (ticker/scrub/revelado/estático) viven en
`DUNA-MOVIMIENTO.md`, en la raíz del repo — léelo primero si es tu primera vez acá. Este README es
sólo el manual de la herramienta.

## Uso

```bash
npm run censar:movimiento -- --url https://x-cafeone.myshopify.com/ --nombre cafeone-home
```

`--url` es lo único requerido. `--nombre` (opcional) es el slug de `<nombre>.md`/`<nombre>.json`
dentro de esta carpeta; sin él, se deriva del host+path de la URL. `--pasos`, `--instantes`,
`--espera-instante-ms`, `--espera-scroll-ms`, `--ancho`, `--alto` ajustan el plan de muestreo — ver
`npm run censar:movimiento -- --ayuda` para el detalle de cada uno.

## Qué hace, en corto

1. Carga la página (`waitUntil: networkidle`, `reducedMotion: "no-preference"` — EXPLÍCITO, para no
   heredar `prefers-reduced-motion: reduce` del entorno que corre el arnés y medir una página
   quieta por accidente).
2. Arma un plan de posiciones de scroll (arriba del todo → el final del documento, parejas).
3. En CADA posición, muestrea varios instantes de tiempo (default 3, cada 400ms) — así se puede
   separar lo que cambia por SCROLL de lo que cambia por TIEMPO.
4. Clasifica cada elemento con movimiento detectado en `ticker`/`scrub`/`revelado` (uno, o varios a
   la vez — ver `DUNA-MOVIMIENTO.md`). Los que no cambian en NINGUNA muestra se descartan del
   reporte (pero se cuentan, para que el `.md` diga cuántos candidatos se barrieron).
5. Deja `<nombre>.md` (legible: tabla de resumen + detalle acotado por elemento) y `<nombre>.json`
   (la traza cruda — TODOS los grupos de scroll y TODAS las muestras de tiempo, pero SÓLO de los
   elementos con movimiento detectado: la traza de los estáticos no aporta nada citable).

## Límites declarados — para no leerlos como bugs

- **`hover` queda FUERA DE ALCANCE.** Este arnés muestrea scroll y tiempo — nunca mueve el puntero
  ni simula `:hover`/`:focus`. Un elemento cuyo único movimiento depende de un estado de
  interacción (un botón que sólo se revela con el cursor encima, `group-hover:opacity-100`) se
  clasifica `estático` acá — no porque el arnés se equivoque, sino porque esa clase de movimiento
  no la ejercita. Si algún día hace falta, es una CAPACIDAD NUEVA (`page.hover()` sobre cada
  candidato, en cada posición de scroll — multiplica el costo de la corrida), no un ajuste de esta
  versión.
- **La granularidad de `--pasos` decide si un efecto continuo se ve como `scrub` o como
  `revelado`.** Si un efecto de scroll (un parallax, por ejemplo) completa TODO su recorrido dentro
  del tramo entre DOS posiciones muestreadas consecutivas, desde la vista del arnés se ve como "un
  cambio, después estable" — `revelado`, aunque el mecanismo real sea continuo. MEDIDO: contra
  `x-cafeone.myshopify.com/` con 6 pasos (default) Y con 20 pasos, TODOS los `<xo-parallax-scroll>`
  del tema real se clasificaron `revelado`, nunca `scrub` — es un dato real (esos parallax completan
  su recorrido dentro de una sola sección, no a lo largo de todo el documento), no un artefacto de
  resolución en este caso puntual, pero el mecanismo SÍ puede producir ese artefacto con un efecto
  más corto que el paso muestreado. Si un elemento importa y su clase no se distingue de un
  `revelado`, subí `--pasos` y volvé a correr.
- **Un ticker que se PAUSA fuera de vista puede leerse como `revelado`.** El criterio de `ticker`
  exige que la MAYORÍA de las posiciones de scroll muestreadas (con ≥2 instantes) muestren cambio
  por tiempo (§ `MINIMO_GRUPOS_PARA_TICKER`/`UMBRAL_MAYORIA_TICKER`, `lib/movimiento/clasificar.ts`).
  MEDIDO: el track de texto de `xo-marquee-item` (cafeone) se movió por tiempo SÓLO en la posición
  de scroll donde estaba visible (probablemente el propio widget pausa su animación cuando sale de
  vista, un patrón común de rendimiento) — con una sola posición mostrando cambio por tiempo, el
  criterio de mayoría no lo alcanza, y el elemento se reporta como `revelado` (cambió una vez, entre
  el estado inicial y el punto donde se congeló). Es una lectura DEFENDIBLE de lo que en verdad pasó
  (el track se movió, y después dejó de hacerlo), no un error, pero conviene saber que un ticker que
  se pausa no siempre se ve como `ticker`.
- **El `desplazamientoAprox`/`velocidadAproxPorSegundo` no tienen una unidad física garantizada.**
  Son magnitudes derivadas de los NÚMEROS de la matriz CSS computada — si esos números representan
  píxeles de traslación, la unidad es px(/s); si representan un factor de escala o un ángulo de
  rotación, la magnitud es adimensional o en grados. El arnés no decodifica la matriz para saber
  cuál es cuál — reporta el TAMAÑO del cambio, no su significado físico.

## El estreno

Las tres trazas del estreno (§ `ARNES-CENSO-MOVIMIENTO-1`, `DECISIONS.md`): `cafeone-home.{md,json}`
(la home del tema real), `cafeone-about.{md,json}` (la página `/pages/about` del mismo tema) y
`muestrario-home.{md,json}` (la home del muestrario de este repo). El asiento de `DECISIONS.md`
compara lo que salió contra lo que ya se sabía del tema real y del propio código — léelo para el
detalle de qué vio y qué no vio la herramienta.
