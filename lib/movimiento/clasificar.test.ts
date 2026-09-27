import { test } from "node:test";
import assert from "node:assert/strict";
import { clasificarElemento, type GrupoScroll } from "./clasificar";

// ── ESTÁTICO — nada cambia, ni con scroll ni con tiempo ─────────────────────────────────────────
test("clasificarElemento: sin cambios en ninguna muestra → estatico, sola", () => {
  const transform = "matrix(1, 0, 0, 1, 0, 0)";
  const grupos: GrupoScroll[] = [0, 100, 200, 300].map((scrollY) => ({
    scrollY,
    muestras: [
      { t: 0, transform, opacity: 1, enViewport: true },
      { t: 300, transform, opacity: 1, enViewport: true },
    ],
  }));

  const resultado = clasificarElemento(grupos);
  assert.deepEqual(resultado.clases, [{ clase: "estatico" }]);
});

test("clasificarElemento: un único grupo con una única muestra → estatico (caso degenerado, sin reventar)", () => {
  const grupos: GrupoScroll[] = [
    { scrollY: 0, muestras: [{ t: 0, transform: "none", opacity: 1, enViewport: true }] },
  ];

  const resultado = clasificarElemento(grupos);
  assert.deepEqual(resultado.clases, [{ clase: "estatico" }]);
});

// ── TICKER — cambia con el tiempo, a scroll fijo, y es EL MISMO cambio en cada posición ──────────
// Modela `HeroMediaMarquesina` tras CORTE-HERO-VELO-OFF-Y-TICKER-1: el eje horizontal avanza por
// TIEMPO (100px/s en este fixture), sin importar dónde esté el scroll — por eso el valor
// REPRESENTATIVO (la última muestra) de cada grupo termina siendo EL MISMO (x=60) en las cuatro
// posiciones: no hay cambio "por scroll" que reportar, sólo ticker.
test("clasificarElemento: cambia con el tiempo igual en cada posición de scroll → ticker, sola", () => {
  const grupos: GrupoScroll[] = [0, 100, 200, 300].map((scrollY) => ({
    scrollY,
    muestras: [0, 300, 600].map((t) => ({
      t,
      transform: `matrix(1, 0, 0, 1, ${t / 10}, 0)`,
      opacity: 1,
      enViewport: true,
    })),
  }));

  const resultado = clasificarElemento(grupos);
  assert.equal(resultado.clases.length, 1);
  assert.equal(resultado.clases[0].clase, "ticker");
  assert.equal(
    (resultado.clases[0] as { velocidadAproxPorSegundo: number | null }).velocidadAproxPorSegundo,
    100,
    "60 unidades en 600ms = 100 unidades/s",
  );
});

// § ARNES-CENSO-MOVIMIENTO-PROMEDIO-TICKER-1, cerrado por CORTE-MARQUEE-VELOCIDAD-REAL-1: un ticker
// en LOOP CORTO (el marquee del hero completa su ciclo en segundos) puede tener uno de sus grupos
// muestreado justo cuando el track saltó de vuelta a su posición inicial — el delta primer↔último
// instante de ESE grupo queda MUY por encima del resto (medido en vivo: ~6.190 px/s contra una
// mediana real de ~238.7 px/s). El PROMEDIO simple no filtra ese outlier; la MEDIANA sí. Este fixture
// reproduce la firma exacta: 4 grupos "limpios" a 100 unidades/s (idéntico al fixture de arriba) más
// UNO cuyo primer↔último instante cruza un reset (delta 280 en 600ms → 466.67 unidades/s) — el
// representativo (última muestra) se mantiene en 60 en TODOS los grupos, así que esto no introduce
// ninguna señal de scroll: aísla la agregación de `velocidadTicker` de todo lo demás.
test("clasificarElemento: un grupo cuyo instante cae sobre el RESET del loop no infla la velocidad reportada — MEDIANA, no promedio", () => {
  const gruposLimpios: GrupoScroll[] = [0, 100, 200, 300].map((scrollY) => ({
    scrollY,
    muestras: [0, 300, 600].map((t) => ({
      t,
      transform: `matrix(1, 0, 0, 1, ${t / 10}, 0)`,
      opacity: 1,
      enViewport: true,
    })),
  }));
  const grupoConReset: GrupoScroll = {
    scrollY: 400,
    muestras: [
      { t: 0, transform: "matrix(1, 0, 0, 1, -220, 0)", opacity: 1, enViewport: true },
      { t: 300, transform: "matrix(1, 0, 0, 1, 30, 0)", opacity: 1, enViewport: true },
      { t: 600, transform: "matrix(1, 0, 0, 1, 60, 0)", opacity: 1, enViewport: true },
    ],
  };
  const grupos = [...gruposLimpios, grupoConReset];

  const resultado = clasificarElemento(grupos);
  assert.equal(resultado.clases.length, 1, "sigue siendo SOLO ticker — el grupo con reset no introduce una señal de scroll falsa");
  assert.equal(resultado.clases[0].clase, "ticker");
  assert.equal(
    (resultado.clases[0] as { velocidadAproxPorSegundo: number | null }).velocidadAproxPorSegundo,
    100,
    "mediana de [100,100,100,100,466.67] = 100 — el outlier del reset queda descartado, no diluido en un promedio (que daría 173.33)",
  );
});

// ── SCRUB — cambia con el scroll, de forma CONTINUA a lo largo de casi todo el recorrido ─────────
// Modela `useProgresoScroll`/`transformAcomodo`: sin variación por tiempo a scroll fijo (una sola
// muestra por posición basta), pero el valor avanza en CADA transición de scroll muestreada.
test("clasificarElemento: cambia en cada paso de scroll, sin variar con el tiempo → scrub, sola", () => {
  const grupos: GrupoScroll[] = [0, 100, 200, 300, 400, 500].map((scrollY) => ({
    scrollY,
    muestras: [{ t: 0, transform: `matrix(1, 0, 0, 1, ${scrollY / 10}, 0)`, opacity: 1, enViewport: true }],
  }));

  const resultado = clasificarElemento(grupos);
  assert.deepEqual(resultado.clases, [{ clase: "scrub", ventanaScrollY: { desde: 0, hasta: 500 } }]);
});

// ── REVELADO (puramente por scroll) — cambia temprano y se queda quieto el resto del recorrido ──
// Modela `opacidadRevelado`/`UMBRAL_REVELADO_TEXTO`: el fade ocurre en la ventana temprana del
// recorrido (acá, las dos primeras transiciones de cinco) y después el elemento NO vuelve a
// cambiar, aunque el scroll siga avanzando otras tres posiciones.
test("clasificarElemento: cambia temprano y se estabiliza → revelado, sola, sin duración medida", () => {
  const opacidades = [0, 0.5, 1, 1, 1, 1];
  const grupos: GrupoScroll[] = [0, 100, 200, 300, 400, 500].map((scrollY, i) => ({
    scrollY,
    muestras: [{ t: 0, transform: "none", opacity: opacidades[i], enViewport: scrollY >= 100 }],
  }));

  const resultado = clasificarElemento(grupos);
  assert.deepEqual(resultado.clases, [
    {
      clase: "revelado",
      desplazamientoAprox: 100,
      duracionMs: null,
      // § ARNES-CENSO-MOVIMIENTO-CALIBRACION-1: el tramo que el arnés usaría para submuestrear si
      // hiciera falta — acá cubre las DOS transiciones que cambiaron (0→100 y 100→200), no sólo la
      // última.
      ventanaScrollY: { desde: 0, hasta: 200 },
    },
  ]);
});

// ── REVELADO con componente TEMPORAL — el asentamiento ocurre DENTRO de una posición de scroll ──
// Modela `useContadorAnimado`: un IntersectionObserver dispara al entrar al viewport y el valor
// sigue cambiando por ~550ms SIN que el visitante siga scrolleando — la única posición con ≥2
// muestras es la que atrapa ese asentamiento; el resto del recorrido, antes y después, es plano.
// ESTE es el caso que `MINIMO_GRUPOS_PARA_TICKER` existe para no confundir con un ticker: sólo HAY
// un grupo con más de una muestra, y ese grupo cambia — sin el mínimo de dos grupos, un umbral de
// mayoría ingenuo lo leería como "100% de los grupos con variación temporal cambian" y lo
// clasificaría ticker.
test("clasificarElemento: se asienta por tiempo en UNA sola posición de scroll → revelado con duración, NO ticker", () => {
  const grupos: GrupoScroll[] = [
    { scrollY: 0, muestras: [{ t: 0, transform: "none", opacity: 0, enViewport: false }] },
    {
      scrollY: 100,
      muestras: [
        { t: 0, transform: "none", opacity: 0.3, enViewport: true },
        { t: 550, transform: "none", opacity: 1, enViewport: true },
      ],
    },
    { scrollY: 200, muestras: [{ t: 0, transform: "none", opacity: 1, enViewport: true }] },
    { scrollY: 300, muestras: [{ t: 0, transform: "none", opacity: 1, enViewport: true }] },
  ];

  const resultado = clasificarElemento(grupos);
  assert.deepEqual(resultado.clases, [
    {
      clase: "revelado",
      desplazamientoAprox: 100,
      duracionMs: 550,
      // La única transición con cambio-por-scroll es la 1ª (scrollY 0→100) — el asentamiento por
      // TIEMPO ocurre DENTRO de esa misma posición (scrollY=100), no en una transición posterior.
      ventanaScrollY: { desde: 0, hasta: 100 },
    },
  ]);
});

// ── AMBIGUO — scrubea Y tickea a la vez, el caso que el spec pide nombrar explícito ──────────────
// Modela el marquee del hero: el eje horizontal ("X") avanza por TIEMPO igual en cada posición de
// scroll (ticker), y el eje vertical ("Y") avanza por SCROLL, constante en el tiempo dentro de cada
// posición (scrub) — DOS motores en el MISMO `transform`, § `lib/animation.ts` (el eje horizontal
// del ticker + el eje vertical/opacidad del revelado, compuestos en dos `motion.*` distintos). La
// función debe reportar LAS DOS, no elegir una.
test("clasificarElemento: un eje tickea y el otro scrubea en el mismo transform → reporta AMBAS clases", () => {
  const grupos: GrupoScroll[] = [0, 100, 200, 300].map((scrollY) => ({
    scrollY,
    muestras: [0, 300, 600].map((t) => ({
      t,
      transform: `matrix(1, 0, 0, 1, ${t / 5}, ${scrollY / 10})`,
      opacity: 1,
      enViewport: true,
    })),
  }));

  const resultado = clasificarElemento(grupos);
  assert.equal(resultado.clases.length, 2, "debe reportar ticker Y scrub, no una sola");
  const clases = resultado.clases.map((c) => c.clase).sort();
  assert.deepEqual(clases, ["scrub", "ticker"]);

  const ticker = resultado.clases.find((c) => c.clase === "ticker") as {
    velocidadAproxPorSegundo: number | null;
  };
  assert.equal(ticker.velocidadAproxPorSegundo, 200, "120 unidades en 600ms = 200 unidades/s");

  const scrub = resultado.clases.find((c) => c.clase === "scrub") as {
    ventanaScrollY: { desde: number; hasta: number };
  };
  assert.deepEqual(scrub.ventanaScrollY, { desde: 0, hasta: 300 });
});

// ── UN TICKER QUE NUNCA SE DETIENE NO ES TAMBIÉN UN SCRUB — el defecto real del primer censo ──────
// MEDIDO, no hipotético: la primera corrida de `censar-movimiento.ts` contra `xo-marquee`
// (cafeone.myshopify.com) reportó ~170 elementos como "ticker + scrub (scrollY 0–19093)" — el
// rango de scroll ENTERO del documento — porque una animación infinita sigue avanzando por tiempo
// REAL mientras el arnés scrollea de una posición a la siguiente, así que el valor representativo
// de cada grupo (§ `representativos`) crece SOLO por el tiempo transcurrido entre grupos, no porque
// el scroll lo mueva. Sin `tAbsolutoUltimaMuestraMs`, no hay forma de distinguir las dos causas.
// Este fixture reproduce esa forma exacta: un valor que avanza LINEALMENTE con el tiempo GLOBAL
// (nunca se reinicia entre grupos, a diferencia del fixture de ticker de arriba, que sí modela un
// reinicio por grupo — la forma REALISTA de una animación CSS infinita).
test("clasificarElemento: un ticker que sigue corriendo ENTRE posiciones de scroll no se reporta también como scrub", () => {
  const VELOCIDAD = 100; // unidades/s, la misma tasa en las cuatro posiciones
  // (scrollY, tAbsolutoDelPrimerInstanteMs) — cada grupo arranca ~2000ms de wall-clock después de
  // que terminó el anterior (el costo real de scrollear + asentar + los 2 instantes previos).
  const arranques = [0, 2600, 5200, 7800];
  const grupos: GrupoScroll[] = [0, 3819, 7637, 11456].map((scrollY, i) => {
    const inicioAbsoluto = arranques[i];
    const muestras = [0, 300, 600].map((tRelativo) => ({
      t: tRelativo,
      transform: `matrix(1, 0, 0, 1, ${((inicioAbsoluto + tRelativo) * VELOCIDAD) / 1000}, 0)`,
      opacity: 1,
      enViewport: true,
    }));
    return {
      scrollY,
      muestras,
      tAbsolutoUltimaMuestraMs: inicioAbsoluto + 600,
    };
  });

  const resultado = clasificarElemento(grupos);
  assert.equal(resultado.clases.length, 1, "sólo ticker — el falso scrub no debe aparecer");
  assert.equal(resultado.clases[0].clase, "ticker");
});

// ── UN TICKER OSCILANTE (no lineal) TAMPOCO ES UN SCRUB — segundo defecto real del primer censo ──
// MEDIDO: tras corregir el defecto de arriba (ticker lineal), el censo real contra cafeone.myshopify.com
// SIGUIÓ reportando ~126 "scrub" falsos — la causa era OTRA forma de la misma familia: un `div` cuya
// opacidad/escala PULSA (salta entre ~0.02 y ~0.85 dentro de un mismo grupo de 800ms, no avanza
// linealmente) — para un ticker así, `velocidad × dt` SUBESTIMA el cambio posible entre dos grupos
// separados por más tiempo que un ciclo del pulso, porque el pulso no "sigue creciendo": vuelve
// sobre el mismo rango acotado. Este fixture reproduce esa forma con los valores REALES observados.
test("clasificarElemento: un ticker que OSCILA (no avanza linealmente) tampoco se reporta como scrub", () => {
  // Valores REALES del censo (`docs/movimiento/cafeone-home.json`, elemento [0]) — opacidad/escala
  // que salta dentro de cada grupo, sin patrón lineal, y con marcas de tiempo reales (gaps ~1450ms).
  const patronesDentroDeGrupo = [
    [0.545394, 0.019173, 0.854045],
    [0.102972, 0.615665, 0.019273],
    [0.401902, 0.146236, 0.544965],
    [0.385167, 0.268865, 0.254217],
  ];
  const tAbsolutoUltimaMuestraMs = [800, 2266, 3714, 5166];
  const grupos: GrupoScroll[] = [0, 3819, 7637, 11456].map((scrollY, i) => ({
    scrollY,
    muestras: [0, 400, 800].map((tRelativo, j) => ({
      t: tRelativo,
      transform: `matrix(${patronesDentroDeGrupo[i][j]}, 0, 0, ${patronesDentroDeGrupo[i][j]}, 0, 0)`,
      opacity: patronesDentroDeGrupo[i][j],
      enViewport: true,
    })),
    tAbsolutoUltimaMuestraMs: tAbsolutoUltimaMuestraMs[i],
  }));

  const resultado = clasificarElemento(grupos);
  assert.equal(resultado.clases.length, 1, "sólo ticker — el pulso no debe leerse como scroll-driven");
  assert.equal(resultado.clases[0].clase, "ticker");
});

// ── UN REVELADO A MITAD DE DOCUMENTO NO ES UN SCRUB — tercer defecto real del primer censo ────────
// MEDIDO: `xo-marquee` (el contenedor, no el track de texto) en cafeone.myshopify.com hace fade-in
// (opacity 0→1) en UNA sola transición, la 4ª de 6 posiciones — 60% del recorrido MUESTREADO, que
// no es "temprano" en términos absolutos. La primera versión de este criterio miraba DÓNDE cae el
// último cambio (¿temprano en el recorrido?) y lo clasificaba `scrub`; lo que importa es CUÁNTAS
// transiciones cambiaron (una sola, de cinco), no en qué posición absoluta del documento ocurre —
// un elemento más abajo en una página larga revela igual de "de una vez" que uno arriba.
test("clasificarElemento: un cambio único A MITAD del recorrido es revelado, no scrub (importa CUÁNTAS transiciones cambian, no DÓNDE)", () => {
  const opacidades = [0, 0, 0, 1, 1, 1]; // cambia sólo en la transición 3 de 5 (60% del recorrido)
  const grupos: GrupoScroll[] = [0, 100, 200, 300, 400, 500].map((scrollY, i) => ({
    scrollY,
    muestras: [{ t: 0, transform: "matrix(1, 0, 0, 1, 0, 0)", opacity: opacidades[i], enViewport: opacidades[i] === 1 }],
  }));

  const resultado = clasificarElemento(grupos);
  assert.deepEqual(resultado.clases, [
    {
      clase: "revelado",
      desplazamientoAprox: 100,
      duracionMs: null,
      // § ARNES-CENSO-MOVIMIENTO-CALIBRACION-1 — control negativo: el tramo cae EXACTAMENTE donde
      // ocurrió el único cambio (scrollY 200→300), a mitad del recorrido muestreado, no al principio
      // — es el tramo que el arnés usaría para submuestrear adaptativamente, si hiciera falta.
      ventanaScrollY: { desde: 200, hasta: 300 },
    },
  ]);
});

// ── Un cambio de FORMA de la matriz ("none" → "matrix(...)") también cuenta como cambio ──────────
// No hace falta que la CANTIDAD de números coincida para detectar diferencia — el elemento pasa de
// no tener transform a tenerlo, que es en sí mismo el cambio que un `revelado` necesita capturar
// (p. ej. `transformAcomodo(..., estatico=true)` rinde literalmente la cadena "none").
test("clasificarElemento: 'none' → una matriz real cuenta como cambio (distinta cantidad de números)", () => {
  const grupos: GrupoScroll[] = [
    { scrollY: 0, muestras: [{ t: 0, transform: "none", opacity: 1, enViewport: false }] },
    { scrollY: 100, muestras: [{ t: 0, transform: "matrix(1, 0, 0, 1, 0, -16)", opacity: 1, enViewport: true }] },
    { scrollY: 200, muestras: [{ t: 0, transform: "matrix(1, 0, 0, 1, 0, -16)", opacity: 1, enViewport: true }] },
    { scrollY: 300, muestras: [{ t: 0, transform: "matrix(1, 0, 0, 1, 0, -16)", opacity: 1, enViewport: true }] },
  ];

  const resultado = clasificarElemento(grupos);
  assert.equal(resultado.clases.length, 1);
  assert.equal(resultado.clases[0].clase, "revelado");
});
