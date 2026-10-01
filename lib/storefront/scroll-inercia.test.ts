import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PASO_INERCIA,
  UMBRAL_ASENTAMIENTO,
  pasoInercia,
  seAsento,
  limiteScroll,
  objetivoTrasRueda,
  debeUsarScrollNativo,
  debeInterceptarRueda,
  CLAVE_SCROLL_PREFIJO,
  claveScrollGuardado,
  parsearScrollGuardado,
  objetivoDeRestauracion,
  estadoInicialEstabilizacion,
  siguienteEstadoEstabilizacion,
  listoParaRestaurar,
  MS_ALTURA_ESTABLE,
  MS_TOPE_ESPERA_ESTABILIZACION,
} from './scroll-inercia';

// Capa 1 del mecanismo de inercia (§ SCROLL-INERCIA-CORTE-1). Puro, sin DOM — lo que se afirma es la
// FÓRMULA (idéntica a `js/app.js:209-244` del prototipo) y las DECISIONES de cuándo interceptar, no
// el envoltorio de `window`/RAF que vive en `ScrollInercia.tsx` (capa 3).

test('PASO_INERCIA y UMBRAL_ASENTAMIENTO son los literales del prototipo (js/app.js:223-224)', () => {
  assert.equal(PASO_INERCIA, 0.12);
  assert.equal(UMBRAL_ASENTAMIENTO, 0.4);
});

test('pasoInercia: la MISMA fórmula que el prototipo — current += (target - current) * 0.12', () => {
  assert.equal(pasoInercia(0, 100), 12);
  assert.equal(pasoInercia(100, 100), 100); // ya en el objetivo: no se mueve
  assert.equal(pasoInercia(50, 0), 44); // 50 + (0 - 50) * 0.12
});

test('pasoInercia acepta un paso custom, sin tocar el default exportado', () => {
  assert.equal(pasoInercia(0, 100, 0.5), 50);
  assert.equal(PASO_INERCIA, 0.12); // el default no se mutó
});

test('pasoInercia: una SERIE de pasos converge hacia el objetivo — la curva del prototipo', () => {
  // Reproduce la secuencia que `ScrollInercia.tsx` dispara frame a frame: la misma fórmula, aplicada
  // repetidamente, tiene que ACERCARSE monótonamente y terminar asentada. Es la mitad Node de "una
  // serie de scrollY por frame… que muestren la misma curva" que el Cierre del slice pide medir
  // también en Chromium (capa 3, sobre DOM real).
  let actual = 0;
  const objetivo = 1000;
  const serie: number[] = [actual];
  // Distancia tras n frames = objetivo·(1-0.12)^n; para llegar bajo el umbral (0.4) hacen falta
  // ~62 frames (1000·0.88^62 ≈ 0.37) — 120 de tope da margen sin volverse una foto del número exacto.
  for (let i = 0; i < 120 && !seAsento(actual, objetivo); i++) {
    actual = pasoInercia(actual, objetivo);
    serie.push(actual);
  }
  // Valores EXACTOS de los primeros 3 frames, a mano contra la fórmula: 0→120→225.6→318.528.
  assert.equal(serie[1], 120);
  assert.equal(serie[2], 225.6);
  assert.equal(Math.round(serie[3] * 1000) / 1000, 318.528);
  // Monótona creciente hacia 1000 (nunca se pasa, nunca retrocede).
  for (let i = 1; i < serie.length; i++) {
    assert.ok(serie[i] > serie[i - 1]);
    assert.ok(serie[i] <= objetivo);
  }
  assert.ok(seAsento(actual, objetivo)); // terminó asentada, no cortada por el tope de 120 frames
});

test('seAsento: estricta (<), no <= — exactamente el umbral NO se considera asentado', () => {
  assert.equal(seAsento(99.6, 100), false); // distancia exacta 0.4
  assert.equal(seAsento(99.61, 100), true); // distancia 0.39, por debajo
  assert.equal(seAsento(100, 100), true); // distancia 0
});

test('seAsento acepta un umbral custom', () => {
  assert.equal(seAsento(95, 100, 5), false); // distancia exacta 5, umbral 5 → no asentado (estricta)
  assert.equal(seAsento(95.1, 100, 5), true);
});

test('limiteScroll: alto del documento menos el viewport', () => {
  assert.equal(limiteScroll(3000, 800), 2200);
});

test('limiteScroll: nunca negativo — un documento más corto que el viewport no tiene scroll', () => {
  assert.equal(limiteScroll(600, 800), 0);
  assert.equal(limiteScroll(800, 800), 0);
});

test('objetivoTrasRueda: acumula el delta sobre el objetivo previo, no sobre la posición actual', () => {
  assert.equal(objetivoTrasRueda(100, 50, 10000), 150);
  assert.equal(objetivoTrasRueda(100, -30, 10000), 70);
});

test('objetivoTrasRueda: acotado a [0, limite] — nunca se sale del documento', () => {
  assert.equal(objetivoTrasRueda(10, -100, 5000), 0); // no baja de 0
  assert.equal(objetivoTrasRueda(4990, 100, 5000), 5000); // no sube del límite
  assert.equal(objetivoTrasRueda(0, -1, 5000), 0);
});

test('debeUsarScrollNativo: movimiento reducido → true, sin importar el puntero', () => {
  assert.equal(debeUsarScrollNativo({ movimientoReducido: true, punteroGrueso: false }), true);
  assert.equal(debeUsarScrollNativo({ movimientoReducido: true, punteroGrueso: true }), true);
});

test('debeUsarScrollNativo: puntero grueso (táctil) → true, aunque no haya movimiento reducido', () => {
  assert.equal(debeUsarScrollNativo({ movimientoReducido: false, punteroGrueso: true }), true);
});

test('debeUsarScrollNativo: ninguna de las dos → false (se monta la inercia)', () => {
  assert.equal(debeUsarScrollNativo({ movimientoReducido: false, punteroGrueso: false }), false);
});

const RUEDA_BASE = { ctrlKey: false, cuerpoBloqueado: false, deltaX: 0, deltaY: 10, dentroDeScrollPropio: false };

test('debeInterceptarRueda: el caso normal (deltaY vertical, nada bloqueado) → true', () => {
  assert.equal(debeInterceptarRueda(RUEDA_BASE), true);
});

test('debeInterceptarRueda: ctrlKey (zoom del navegador) → false', () => {
  assert.equal(debeInterceptarRueda({ ...RUEDA_BASE, ctrlKey: true }), false);
});

test('debeInterceptarRueda: cuerpo bloqueado (modal/drawer con scroll-lock) → false', () => {
  assert.equal(debeInterceptarRueda({ ...RUEDA_BASE, cuerpoBloqueado: true }), false);
});

test('debeInterceptarRueda: dentro de un elemento con scroll propio → false', () => {
  assert.equal(debeInterceptarRueda({ ...RUEDA_BASE, dentroDeScrollPropio: true }), false);
});

test('debeInterceptarRueda: gesto predominantemente HORIZONTAL (trackpad, el track del riel) → false', () => {
  assert.equal(debeInterceptarRueda({ ...RUEDA_BASE, deltaX: 20, deltaY: 5 }), false);
});

test('debeInterceptarRueda: deltaX igual a deltaY → sigue interceptando (no ESTRICTAMENTE mayor)', () => {
  assert.equal(debeInterceptarRueda({ ...RUEDA_BASE, deltaX: 10, deltaY: 10 }), true);
});

test('debeInterceptarRueda: deltaX levemente mayor que deltaY (diagonal, gana el eje vertical) → true', () => {
  // Un trackpad puro-vertical casi nunca da deltaX===0 exacto; sólo un deltaX CLARAMENTE dominante
  // (el caso de arriba) debe ceder el gesto al scroll horizontal.
  assert.equal(debeInterceptarRueda({ ...RUEDA_BASE, deltaX: 2, deltaY: 10 }), true);
});

test('debeInterceptarRueda: las CUATRO salidas son independientes — cualquiera sola basta para no interceptar', () => {
  assert.equal(debeInterceptarRueda({ ctrlKey: true, cuerpoBloqueado: false, deltaX: 0, deltaY: 10, dentroDeScrollPropio: false }), false);
  assert.equal(debeInterceptarRueda({ ctrlKey: false, cuerpoBloqueado: true, deltaX: 0, deltaY: 10, dentroDeScrollPropio: false }), false);
  assert.equal(debeInterceptarRueda({ ctrlKey: false, cuerpoBloqueado: false, deltaX: 30, deltaY: 10, dentroDeScrollPropio: false }), false);
  assert.equal(debeInterceptarRueda({ ctrlKey: false, cuerpoBloqueado: false, deltaX: 0, deltaY: 10, dentroDeScrollPropio: true }), false);
});

// § SUSCRIPCION-TITULO-Y-RECARGA-1 — la restauración de scroll al recargar. Ver el docstring en
// `scroll-inercia.ts` para la medición completa (Chromium clampea contra un documento que todavía
// no creció; WebKit no tiene el defecto).

test('claveScrollGuardado: namespaced con el prefijo y la ruta exacta — "/" y "/tienda" no chocan', () => {
  assert.equal(claveScrollGuardado('/'), `${CLAVE_SCROLL_PREFIJO}/`);
  assert.equal(claveScrollGuardado('/tienda'), `${CLAVE_SCROLL_PREFIJO}/tienda`);
  assert.notEqual(claveScrollGuardado('/'), claveScrollGuardado('/tienda'));
});

test('parsearScrollGuardado: null (nunca se guardó nada) → null', () => {
  assert.equal(parsearScrollGuardado(null), null);
});

test('parsearScrollGuardado: un número válido en texto → ese número', () => {
  assert.equal(parsearScrollGuardado('2576'), 2576);
  assert.equal(parsearScrollGuardado('0'), 0);
});

test('parsearScrollGuardado: basura no numérica o negativa → null — preferir callar a restaurar un número inventado', () => {
  assert.equal(parsearScrollGuardado('no-es-un-numero'), null);
  assert.equal(parsearScrollGuardado('-50'), null);
  assert.equal(parsearScrollGuardado('Infinity'), null);
});

test('objetivoDeRestauracion: el guardado cabe en el documento actual → se restaura tal cual', () => {
  assert.equal(objetivoDeRestauracion(2576, 6052, 900), 2576);
});

test('objetivoDeRestauracion: el guardado EXCEDE el límite actual del documento → se recorta — la causa raíz del defecto (Chromium restauraba contra un documento aún chico)', () => {
  // El caso medido: antes=5152 (la página completa, 6052-900), pero el documento SÓLO tiene 4751px
  // en el instante de restaurar → el límite es 3851, y restaurar más allá de eso sería imposible de
  // todos modos (no hay dónde desplazarse).
  assert.equal(objetivoDeRestauracion(5152, 4751, 900), 3851);
});

test('objetivoDeRestauracion: nunca negativo, aunque el documento sea más corto que el viewport', () => {
  assert.equal(objetivoDeRestauracion(500, 600, 900), 0);
});

test('siguienteEstadoEstabilizacion: la MISMA altura → `ultimoCambioMs` NO se toca, el documento sigue quieto desde que cambió por última vez', () => {
  const inicial = estadoInicialEstabilizacion(900, 0);
  const uno = siguienteEstadoEstabilizacion(inicial, 900, 100);
  assert.deepEqual(uno, { altura: 900, ultimoCambioMs: 0 }, 'misma altura: el reloj de "desde cuándo" no avanza');
  const dos = siguienteEstadoEstabilizacion(uno, 900, 250);
  assert.deepEqual(dos, { altura: 900, ultimoCambioMs: 0 }, 'sigue sin avanzar, aunque pasen más lecturas');
});

test('siguienteEstadoEstabilizacion: la altura CAMBIA → `ultimoCambioMs` se reinicia al reloj de ESTA lectura', () => {
  const estado = { altura: 900, ultimoCambioMs: 0 };
  const siguiente = siguienteEstadoEstabilizacion(estado, 4751, 300);
  assert.deepEqual(siguiente, { altura: 4751, ultimoCambioMs: 300 });
});

test('siguienteEstadoEstabilizacion/listoParaRestaurar: reproduce la SERIE medida (900→4751→6337) — un PLANO INTERMEDIO que dura MENOS que MS_ALTURA_ESTABLE no se confunde con el final', () => {
  // La serie real (§ el docstring de arriba): 900 de t=0 a t≈300, 4751 de t≈300 a t≈600, 6337 desde
  // ahí. El plano de 4751 dura sólo ~300ms — muy por debajo de MS_ALTURA_ESTABLE (1800) — así que
  // NUNCA debe declararse listo mientras el reloj sigue dentro de ese plano.
  let estado = estadoInicialEstabilizacion(900, 0);
  estado = siguienteEstadoEstabilizacion(estado, 4751, 300);
  assert.ok(!listoParaRestaurar(estado, 600, 0), 'a los 600ms, el plano de 4751 sólo lleva 300ms quieto — no alcanza');
  estado = siguienteEstadoEstabilizacion(estado, 6337, 600);
  assert.ok(!listoParaRestaurar(estado, 600 + MS_ALTURA_ESTABLE - 1, 0), 'un instante antes de los 1800ms de quietud en 6337, todavía no');
  assert.ok(listoParaRestaurar(estado, 600 + MS_ALTURA_ESTABLE, 0), 'a los 1800ms exactos de quietud en la altura final, ya sí');
});

test('listoParaRestaurar: el PLANO INTERMEDIO del despliegue real (~1.500ms) tampoco alcanza MS_ALTURA_ESTABLE — es la causa raíz que el primer diseño (por conteo de frames) no cubría', () => {
  // La medición más lenta (§ el asiento de DECISIONS.md): 4768 de t≈1.500 a t≈3.000ms antes de
  // llegar a 6052. Ese plano de ~1.500ms sigue por DEBAJO de MS_ALTURA_ESTABLE (1800) — con margen
  // chico a propósito (medido, no elegido con holgura infinita).
  let estado = estadoInicialEstabilizacion(900, 0);
  estado = siguienteEstadoEstabilizacion(estado, 4768, 1500);
  assert.ok(!listoParaRestaurar(estado, 3000, 0), 'a los 3000ms, el plano de 4768 lleva 1500ms — por debajo del umbral de 1800');
});

test('listoParaRestaurar: el TOPE DE TIEMPO TOTAL es la salida de emergencia — si la altura NUNCA se asienta, igual se restaura', () => {
  let estado = estadoInicialEstabilizacion(100, 0);
  // La altura cambia CADA 10ms, hasta justo antes del tope total — `ultimoCambioMs` queda siempre
  // RECIENTE (nunca pasa MS_ALTURA_ESTABLE desde el último cambio), así que sin el tope de tiempo
  // TOTAL esto esperaría para siempre.
  const ultimoCambioMs = MS_TOPE_ESPERA_ESTABILIZACION - 10;
  for (let t = 10; t <= ultimoCambioMs; t += 10) estado = siguienteEstadoEstabilizacion(estado, 100 + t, t);
  assert.equal(estado.altura, 100 + ultimoCambioMs);
  assert.equal(listoParaRestaurar(estado, MS_TOPE_ESPERA_ESTABILIZACION - 1, 0), false, 'la altura cambió hace sólo 9ms — ni estable ni se agotó el tope total');
  assert.equal(listoParaRestaurar(estado, MS_TOPE_ESPERA_ESTABILIZACION, 0), true, 'el tope total se cruza, aunque la altura siga cambiando cada 10ms');
});

test('listoParaRestaurar: las DOS salidas son independientes — un tope de tiempo cruzado basta, aunque la altura siga fresca', () => {
  const estado = estadoInicialEstabilizacion(900, 500); // cambió hace sólo 10ms al momento de medir
  assert.equal(listoParaRestaurar(estado, 510, 0), false, 'ni estable ni se agotó el tiempo total');
  assert.equal(listoParaRestaurar(estado, 0 + MS_TOPE_ESPERA_ESTABILIZACION, 0), true, 'el tope total manda aunque la altura acabe de cambiar');
});

test("RESTAURACION-CEDE-AL-USUARIO-1: tocar, arrastrar, rueda o teclado cancelan la restauración; scroll no", async () => {
  const { EVENTOS_QUE_CANCELAN_RESTAURACION } = await import("./scroll-inercia");
  for (const ev of ["wheel", "touchstart", "pointerdown", "keydown"]) assert.ok((EVENTOS_QUE_CANCELAN_RESTAURACION as readonly string[]).includes(ev), ev);
  assert.ok(!(EVENTOS_QUE_CANCELAN_RESTAURACION as readonly string[]).includes("scroll"));
});
