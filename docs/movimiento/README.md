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
`--espera-instante-ms`, `--espera-scroll-ms`, `--ancho`, `--alto`, `--pasos-adaptativos` ajustan el
plan de muestreo — ver `npm run censar:movimiento -- --ayuda` para el detalle de cada uno.

## Qué hace, en corto

1. Carga la página (`waitUntil: networkidle`, `reducedMotion: "no-preference"` — EXPLÍCITO, para no
   heredar `prefers-reduced-motion: reduce` del entorno que corre el arnés y medir una página
   quieta por accidente).
2. Arma un plan de posiciones de scroll (arriba del todo → el final del documento, parejas).
3. En CADA posición, muestrea varios instantes de tiempo (default 3, cada 400ms) — así se puede
   separar lo que cambia por SCROLL de lo que cambia por TIEMPO.
4. **CALIBRACIÓN (b) — pasos adaptativos** (§ `ARNES-CENSO-MOVIMIENTO-CALIBRACION-1`, default 3
   sub-pasos, `0` desactiva): clasifica PRELIMINARMENTE con la traza gruesa; cualquier tramo donde
   esa clasificación dio `revelado` se vuelve a muestrear con más resolución LOCAL (sólo ESE tramo,
   no todo el documento), y se reclasifica con la traza ampliada — así un efecto continuo que cabía
   entero entre dos pasos consecutivos (§ el límite de abajo) tiene una segunda oportunidad de
   mostrarse como lo que es.
5. **CALIBRACIÓN (a) — el eje de TIEMPO se filtra por vista**: antes de clasificar (tanto en la
   pasada preliminar como en la final), cualquier grupo donde el elemento NO estuvo en el viewport
   en NINGUNA de sus muestras se colapsa a una sola muestra representativa — así una posición donde
   el elemento está fuera de pantalla (y presumiblemente pausado ahí) no cuenta como "no cambia" al
   evaluar si tickea.
6. Clasifica cada elemento con movimiento detectado en `ticker`/`scrub`/`revelado` (uno, o varios a
   la vez — ver `DUNA-MOVIMIENTO.md`). Los que no cambian en NINGUNA muestra se descartan del
   reporte (pero se cuentan, para que el `.md` diga cuántos candidatos se barrieron).
7. Deja `<nombre>.md` (legible: tabla de resumen + detalle acotado por elemento, con cuántas
   posiciones tuvo cada elemento en viewport y qué tramos se refinaron) y `<nombre>.json` (la traza
   cruda — TODOS los grupos de scroll, gruesos y adaptativos, y TODAS las muestras de tiempo, pero
   SÓLO de los elementos con movimiento detectado: la traza de los estáticos no aporta nada citable).

## Límites declarados — para no leerlos como bugs

- **`hover` queda FUERA DE ALCANCE.** Este arnés muestrea scroll y tiempo — nunca mueve el puntero
  ni simula `:hover`/`:focus`. Un elemento cuyo único movimiento depende de un estado de
  interacción (un botón que sólo se revela con el cursor encima, `group-hover:opacity-100`) se
  clasifica `estático` acá — no porque el arnés se equivoque, sino porque esa clase de movimiento
  no la ejercita. Si algún día hace falta, es una CAPACIDAD NUEVA (`page.hover()` sobre cada
  candidato, en cada posición de scroll — multiplica el costo de la corrida), no un ajuste de esta
  versión.
- **La granularidad de `--pasos` decide si un efecto continuo se ve como `scrub` o como
  `revelado` — CALIBRADO parcialmente, § `ARNES-CENSO-MOVIMIENTO-CALIBRACION-1`.** La versión
  original de este límite decía que subir `--pasos` GLOBALMENTE no alcanzaba (MEDIDO: 6 pasos y 20
  pasos daban el mismo resultado contra `x-cafeone.myshopify.com/`, porque la resolución nueva se
  reparte por TODO el documento, no dentro del tramo angosto donde hace falta). Los PASOS
  ADAPTATIVOS (arriba) atacan exactamente eso: refinan SÓLO el tramo que produjo `revelado`, no el
  documento entero. Re-medido tras calibrar (`cafeone-home`, 2026-09-27): de 179 elementos con
  movimiento (0 `scrub`, todo `ticker`/`revelado`) se pasó a 225 (**59 ahora `scrub`**, antes
  invisibles a esa clase) — la mayoría de los `<xo-parallax-scroll>`/`<xo-animate>` del tema SÍ son
  continuos, sólo que su ventana era más angosta que un paso parejo. **Lo que SIGUE siendo un límite
  real, no resuelto:** un efecto cuyo recorrido completo cabe DENTRO de la ventana más fina que
  produce un `--pasos-adaptativos` dado seguirá leyendo `revelado` — CONFIRMADO en esta misma
  re-medición: varios `<xo-parallax-scroll>` siguieron `revelado` puro incluso con el refinamiento
  (su ventana, tras refinar, quedó AÚN MÁS angosta pero seguía siendo un salto único) — es la lectura
  correcta para esos casos, no un defecto pendiente. Si un elemento importa y su clase no se
  distingue de un `revelado` con el refinamiento default, subí `--pasos-adaptativos` (más sub-pasos
  DENTRO del mismo tramo) en vez de `--pasos` (que vuelve a repartir la resolución por todo el
  documento).
- **Un ticker que se PAUSA fuera de vista puede leerse como `revelado` — CALIBRADO, §
  `ARNES-CENSO-MOVIMIENTO-CALIBRACION-1`.** La causa medida seguía siendo la misma
  (`MINIMO_GRUPOS_PARA_TICKER`/`UMBRAL_MAYORIA_TICKER`, `lib/movimiento/clasificar.ts`, exigen
  MAYORÍA de posiciones EN VIEWPORT mostrando cambio por tiempo), pero la pasada gruesa sólo
  ofrecía UNA posición donde `xo-marquee-item` (cafeone) estaba visible — insuficiente para hablar
  de mayoría. Los pasos adaptativos (que insertan resolución exactamente en el tramo donde el
  elemento reveló algo, que suele ser DONDE está su rango visible) le dieron al arnés más
  oportunidades de muestrearlo EN VISTA: re-medido, `xo-marquee-item` pasó de `revelado` puro a
  `ticker` (116.6 u/s) — el hueco que este límite describía YA NO ocurre para ese caso concreto.
  **Lo que sigue siendo un límite real:** un elemento visible en una franja TAN angosta que ni
  siquiera los sub-pasos adaptativos caen dentro de ella seguirá sin alcanzar el mínimo de 2
  posiciones-en-vista, y el reporte lo declara (`posicionesEnViewport: {visibles, total}` en el
  `.json`, la columna "en viewport" del `.md`) — `0/N` (marcado `⚠`) es el caso extremo, "nunca
  visible", que el arnés declara en vez de aventurar una clase que los datos no describen.
- **El `desplazamientoAprox`/`velocidadAproxPorSegundo` no tienen una unidad física garantizada.**
  Son magnitudes derivadas de los NÚMEROS de la matriz CSS computada — si esos números representan
  píxeles de traslación, la unidad es px(/s); si representan un factor de escala o un ángulo de
  rotación, la magnitud es adimensional o en grados. El arnés no decodifica la matriz para saber
  cuál es cuál — reporta el TAMAÑO del cambio, no su significado físico.
- **NUEVO, hallazgo de la calibración — un ticker que hace LOOP (repite su recorrido) puede
  contaminar el promedio de velocidad con un salto de "fin de vuelta a inicio".** MEDIDO contra
  `muestrario-home`: el track del marquee (`div.flex`, animate `x:['0%','-50%']` con
  `repeat:Infinity`) saltó de vuelta a su posición de arranque DENTRO de una ventana de 800ms de
  muestreo al menos una vez en la corrida — `analizarEje` promedia la velocidad de TODOS los grupos
  que muestran cambio, así que ese salto (miles de u/s) infla el promedio reportado muy por encima
  de la velocidad real de traslación continua. **NO se corrigió en esta calibración** (no era uno de
  los dos huecos que este slice atacaba, y tocar el promediado de `analizarEje` es una tercera
  calibración con su propio criterio de corte) — documentado acá para que quien reporte una
  velocidad de ticker con loop corto SEPA que el promedio simple puede mentir, y calcule a mano una
  MEDIANA o descarte los valores atípicos, como hizo el asiento de `DECISIONS.md` de esta calibración
  para responder la pregunta del owner sobre la velocidad del marquee.

## El estreno, y la calibración

Las tres trazas del estreno (§ `ARNES-CENSO-MOVIMIENTO-1`, `DECISIONS.md`): `cafeone-home.{md,json}`
(la home del tema real), `cafeone-about.{md,json}` (la página `/pages/about` del mismo tema) y
`muestrario-home.{md,json}` (la home del muestrario de este repo). El asiento de `DECISIONS.md`
compara lo que salió contra lo que ya se sabía del tema real y del propio código — léelo para el
detalle de qué vio y qué no vio la herramienta.

**`cafeone-home.{md,json}` y `muestrario-home.{md,json}` se RE-CORRIERON con el arnés calibrado**
(§ `ARNES-CENSO-MOVIMIENTO-CALIBRACION-1`, 2026-09-27, `DECISIONS.md`) — son las trazas VIGENTES,
con pasos adaptativos y la columna de visibilidad. **`cafeone-about.{md,json}` NO se tocó** (fuera
del alcance de esa calibración — no estaba entre las URLs a re-medir) y sigue siendo la traza del
arnés SIN calibrar; no comparar sus números contra los otros dos sin tener esto presente.
