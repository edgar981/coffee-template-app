import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  construirHorizonte,
  rellenoBajoHorizonte,
  faseDeLinea,
  alturaOnda,
  amplitudDeLinea,
  opacidadDeLinea,
  esAcento,
  HORIZONTE_NUM_LINEAS,
  HORIZONTE_NUM_AMBAR,
  HORIZONTE_ANCHO,
  HORIZONTE_ALTO,
  HORIZONTE_DURACION_S,
  HORIZONTE_DIRECCION,
  HORIZONTE_TOPE_Y,
  HORIZONTE_BANDA_FRACCION,
} from './duna-horizonte';

// ─── EL INVARIANTE DE ESTE SLICE: NINGÚN PAR DE LÍNEAS SE CRUZA JAMÁS ──────────
// (PANEL-LOGIN-HORIZONTE-FAMILIA-1). Es la propiedad que hace que el horizonte se
// lea como UNA superficie, no como trazos independientes -- lo que el owner señaló
// que faltaba comparando /login contra la pieza de marca de Duna.

/**
 * Altura EN PANTALLA de una línea en la posición X y el instante τ (segundos),
 * reproduciendo EXACTAMENTE lo que hace la traslación CSS: un punto dibujado en
 * la coordenada LOCAL `path_x` del `<path>` estático aparece en pantalla en
 * `path_x + translateX(τ)`, así que la altura visible en X es la del punto local
 * `X − translateX(τ)`. El keyframe (`app/globals.css`) va de `translateX(0)` a
 * `translateX(-periodo·direccion)` en `duracionS` segundos, LINEAL, así que
 * `translateX(τ) = frac(τ/duracionS) · (−periodo·direccion)`.
 */
function alturaEnPantalla(
  linea: { indice: number; y: number; periodoPx: number },
  x: number,
  tauSeg: number,
): number {
  const fT = (((tauSeg % HORIZONTE_DURACION_S) + HORIZONTE_DURACION_S) % HORIZONTE_DURACION_S) / HORIZONTE_DURACION_S;
  const translateX = fT * (-linea.periodoPx * HORIZONTE_DIRECCION);
  const pathX = x - translateX;
  const fase = faseDeLinea(linea.indice, linea.periodoPx);
  const amplitud = amplitudDeLinea(linea.indice);
  return linea.y + alturaOnda(pathX, linea.periodoPx, fase, amplitud);
}

test('INVARIANTE no-cruce: ninguna línea vecina se cruza, barriendo x a lo largo de un período y t a lo largo de un ciclo', () => {
  const lineas = construirHorizonte();
  const periodo = lineas[0].periodoPx; // compartido -- ver el test de abajo que lo afirma
  const PASOS_X = 60;
  const PASOS_T = 24;
  for (let i = 0; i < lineas.length - 1; i++) {
    const a = lineas[i];
    const b = lineas[i + 1];
    for (let px = 0; px <= PASOS_X; px++) {
      const x = (px / PASOS_X) * periodo;
      for (let pt = 0; pt <= PASOS_T; pt++) {
        const tau = (pt / PASOS_T) * HORIZONTE_DURACION_S;
        const ya = alturaEnPantalla(a, x, tau);
        const yb = alturaEnPantalla(b, x, tau);
        assert.ok(
          ya < yb,
          `líneas ${i}/${i + 1} se cruzan en x=${x.toFixed(1)}, τ=${tau.toFixed(1)}: y${i}=${ya.toFixed(3)} y${i + 1}=${yb.toFixed(3)}`,
        );
      }
    }
  }
});

test('INVARIANTE no-cruce con MÁS líneas de las por defecto (construirHorizonte(20)) -- la propiedad no depende del N por defecto', () => {
  const lineas = construirHorizonte(20, 5);
  const periodo = lineas[0].periodoPx;
  for (let i = 0; i < lineas.length - 1; i++) {
    const a = lineas[i];
    const b = lineas[i + 1];
    for (let px = 0; px <= 30; px++) {
      const x = (px / 30) * periodo;
      for (let pt = 0; pt <= 12; pt++) {
        const tau = (pt / 12) * HORIZONTE_DURACION_S;
        assert.ok(alturaEnPantalla(a, x, tau) < alturaEnPantalla(b, x, tau), `líneas ${i}/${i + 1} (N=20) se cruzan`);
      }
    }
  }
});

// ─── La separación vertical, DERIVADA de la amplitud máxima (no elegida a ojo) ─

test('la separación entre baselines vecinas SUPERA el doble de la amplitud máxima -- la desigualdad que blinda el invariante', () => {
  const lineas = construirHorizonte();
  const amplitudMax = Math.max(...lineas.map((_, i) => amplitudDeLinea(i)));
  for (let i = 0; i < lineas.length - 1; i++) {
    const sep = lineas[i + 1].y - lineas[i].y;
    assert.ok(sep > 2 * amplitudMax, `separación ${sep} no supera 2×${amplitudMax} entre líneas ${i}/${i + 1}`);
  }
});

// ─── Todas las líneas comparten UNA sola onda (frecuencia, velocidad, sentido) ─

test('todas las líneas comparten el MISMO período -- no hay longitud de onda que crezca con el índice', () => {
  const lineas = construirHorizonte();
  const periodos = new Set(lineas.map((l) => l.periodoPx));
  assert.equal(periodos.size, 1, 'debería haber un único período compartido por todas las líneas');
});

test('HORIZONTE_DURACION_S y HORIZONTE_DIRECCION son constantes ÚNICAS -- no hay velocidad ni sentido por línea', () => {
  assert.equal(typeof HORIZONTE_DURACION_S, 'number');
  assert.ok(HORIZONTE_DURACION_S > 0);
  assert.ok(HORIZONTE_DIRECCION === 1 || HORIZONTE_DIRECCION === -1);
});

test('alturaOnda es un seno PURO (una sola onda -- se perdió el segundo armónico, § DECISIONS.md)', () => {
  const periodo = 400;
  const amplitud = 7;
  const esperado = amplitud * Math.sin((2 * Math.PI * (periodo / 4)) / periodo); // = amplitud, en el cuarto de período
  const obtenido = alturaOnda(periodo / 4, periodo, 0, amplitud);
  assert.ok(Math.abs(obtenido - esperado) < 1e-9);
});

test('cada línea es periódica en su propio período -- la condición del loop sin costura', () => {
  const periodo = 420;
  for (let indice = 0; indice < HORIZONTE_NUM_LINEAS; indice++) {
    const fase = faseDeLinea(indice, periodo);
    const amplitud = amplitudDeLinea(indice);
    for (const x of [-800, -137.4, 0, 42.7, 900, 1439.9]) {
      const a = alturaOnda(x, periodo, fase, amplitud);
      const b = alturaOnda(x + periodo, periodo, fase, amplitud);
      assert.ok(
        Math.abs(a - b) < 1e-9,
        `línea ${indice}, x=${x}: alturaOnda(x)=${a} != alturaOnda(x+periodo)=${b}`,
      );
    }
  }
});

test('amplitudDeLinea crece apenas y monótonamente con el índice', () => {
  for (let i = 1; i < HORIZONTE_NUM_LINEAS; i++) {
    assert.ok(amplitudDeLinea(i) > amplitudDeLinea(i - 1));
  }
});

test('el PASO de desfase entre líneas VECINAS es CHICO -- una fracción pequeña del período, no una fracción grande (§ el defecto que este slice revierte: `indice * periodo * 0.37`, un tercio del período)', () => {
  const periodo = 420;
  for (let i = 1; i < HORIZONTE_NUM_LINEAS; i++) {
    const paso = faseDeLinea(i, periodo) - faseDeLinea(i - 1, periodo);
    assert.ok(Math.abs(paso) < periodo * 0.1, `paso de desfase entre líneas ${i - 1}/${i} (${paso}) no es chico relativo al período`);
  }
});

// ─── construirHorizonte — la forma del conjunto ────────────────────────────────

test('construirHorizonte devuelve N líneas, en orden, índice 0..N-1', () => {
  const lineas = construirHorizonte();
  assert.equal(lineas.length, HORIZONTE_NUM_LINEAS);
  lineas.forEach((l, i) => assert.equal(l.indice, i));
});

test('las últimas NUM_AMBAR líneas (las más al frente) son de acento; el resto, neutras', () => {
  const lineas = construirHorizonte();
  const acentos = lineas.filter((l) => l.acento);
  assert.equal(acentos.length, HORIZONTE_NUM_AMBAR);
  // Contiguas, y las de mayor índice (más al frente).
  for (const l of acentos) assert.ok(l.indice >= HORIZONTE_NUM_LINEAS - HORIZONTE_NUM_AMBAR);
  const neutras = lineas.filter((l) => !l.acento);
  for (const l of neutras) assert.ok(l.indice < HORIZONTE_NUM_LINEAS - HORIZONTE_NUM_AMBAR);
});

test('esAcento nunca revienta con numAcento fuera de rango (defensivo)', () => {
  assert.equal(esAcento(0, 6, 0), false);
  assert.equal(esAcento(5, 6, 6), true);
  assert.equal(esAcento(0, 6, 999), true); // clamp: numAcento > total -> todas acento
  assert.equal(esAcento(5, 6, -3), false); // clamp: negativo -> ninguna acento
});

test('la opacidad DECAE hacia el fondo: monótona no-decreciente con el índice', () => {
  const lineas = construirHorizonte();
  for (let i = 1; i < lineas.length; i++) {
    assert.ok(lineas[i].opacidad > lineas[i - 1].opacidad, `línea ${i} no es más opaca que ${i - 1}`);
  }
  // La más cercana (frente) conserva el mismo valor que llevaba la cresta única.
  assert.equal(lineas[lineas.length - 1].opacidad, 0.5);
});

test('opacidadDeLinea con una sola línea total no revienta (caso degenerado)', () => {
  assert.equal(opacidadDeLinea(0, 1), 0.5);
});

test('cada línea tiene un `d` no vacío que arranca con M, y no son todas idénticas', () => {
  const lineas = construirHorizonte();
  const ds = new Set<string>();
  for (const l of lineas) {
    assert.ok(l.d.startsWith('M '));
    assert.ok(l.d.length > 10);
    ds.add(l.d);
  }
  assert.equal(ds.size, lineas.length, 'dos líneas con el mismo `d` -- la variación por índice no está aplicando');
});

test('el trazo se extiende un período de más a cada lado del viewBox visible', () => {
  const lineas = construirHorizonte();
  for (const l of lineas) {
    assert.equal(l.x0, -l.periodoPx);
    assert.equal(l.x1, HORIZONTE_ANCHO + l.periodoPx);
  }
});

// ─── rellenoBajoHorizonte ───────────────────────────────────────────────────────

test('rellenoBajoHorizonte cierra el path hasta el borde inferior del viewBox', () => {
  const lineas = construirHorizonte();
  const relleno = rellenoBajoHorizonte(lineas);
  const frente = lineas[lineas.length - 1];
  assert.ok(relleno.endsWith('Z'));
  assert.ok(relleno.includes(`L ${frente.x1.toFixed(2)} ${HORIZONTE_ALTO}`));
  assert.ok(relleno.includes(`L ${frente.x0.toFixed(2)} ${HORIZONTE_ALTO}`));
  assert.ok(relleno.startsWith(frente.d));
});

test('rellenoBajoHorizonte con lista vacía no revienta: devuelve string vacío', () => {
  assert.equal(rellenoBajoHorizonte([]), '');
});

// ─── La banda que el chasis reserva ─────────────────────────────────────────────

test('HORIZONTE_TOPE_Y es menor que la baseline de la línea más lejana (deja margen para su onda)', () => {
  assert.ok(HORIZONTE_TOPE_Y < 40);
});

test('HORIZONTE_BANDA_FRACCION es positiva y razonable (no ocupa medio viewport)', () => {
  assert.ok(HORIZONTE_BANDA_FRACCION > 0);
  assert.ok(HORIZONTE_BANDA_FRACCION < 0.3);
});

test('HORIZONTE_BANDA_FRACCION se deriva de HORIZONTE_TOPE_Y -- una sola fuente, no dos números sueltos', () => {
  const esperado = (HORIZONTE_ALTO - HORIZONTE_TOPE_Y) / HORIZONTE_ANCHO;
  assert.equal(HORIZONTE_BANDA_FRACCION, esperado);
});

// ─── construirHorizonte con parámetros -- para no asumir sólo el default ────────

test('construirHorizonte respeta un numLineas/numAmbar/ancho explícitos', () => {
  const lineas = construirHorizonte(3, 1, 800);
  assert.equal(lineas.length, 3);
  assert.equal(lineas.filter((l) => l.acento).length, 1);
  assert.equal(lineas[2].acento, true); // la única de acento es la más al frente
  for (const l of lineas) assert.equal(l.x1, 800 + l.periodoPx);
});
