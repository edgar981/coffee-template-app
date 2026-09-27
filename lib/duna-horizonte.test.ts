import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  construirHorizonte,
  rellenoBajoHorizonte,
  periodoDeLinea,
  faseDeLinea,
  alturaOnda,
  opacidadDeLinea,
  esAcento,
  HORIZONTE_NUM_LINEAS,
  HORIZONTE_NUM_AMBAR,
  HORIZONTE_ANCHO,
  HORIZONTE_ALTO,
  HORIZONTE_TOPE_Y,
  HORIZONTE_BANDA_FRACCION,
} from './duna-horizonte';

// ─── El invariante que hace válida la animación por CSS: el LOOP SIN COSTURA ───
// `transform: translateX` sólo se puede animar en bucle sin salto visible si la
// curva es analíticamente periódica en su propio `periodoPx`. Si esto fallara, la
// animación se vería "saltar" una vez por ciclo -- justo el defecto que la técnica
// existe para evitar.

test('cada línea es periódica en su propio período -- la condición del loop sin costura', () => {
  for (let indice = 0; indice < HORIZONTE_NUM_LINEAS; indice++) {
    const periodo = periodoDeLinea(indice);
    const fase = faseDeLinea(indice, periodo);
    for (const x of [-800, -137.4, 0, 42.7, 900, 1439.9]) {
      const a = alturaOnda(x, periodo, fase);
      const b = alturaOnda(x + periodo, periodo, fase);
      assert.ok(
        Math.abs(a - b) < 1e-9,
        `línea ${indice}, x=${x}: alturaOnda(x)=${a} != alturaOnda(x+periodo)=${b}`,
      );
    }
  }
});

test('alturaOnda combina DOS frecuencias -- no es un seno puro', () => {
  // Si sólo hubiera una onda, la altura en el cuarto de período sería exactamente
  // la amplitud de esa única onda. Con el segundo armónico superpuesto, no lo es.
  const periodo = 400;
  const soloUnaOnda = Math.sin((2 * Math.PI * (periodo / 4)) / periodo); // = 1, sin escalar
  const conArmonico = alturaOnda(periodo / 4, periodo, 0);
  assert.notEqual(conArmonico, soloUnaOnda);
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

test('las líneas alternan de dirección -- para que se crucen, no viajen en bloque', () => {
  const lineas = construirHorizonte();
  const direcciones = lineas.map((l) => l.direccion);
  assert.ok(direcciones.includes(1) && direcciones.includes(-1));
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
  assert.ok(HORIZONTE_TOPE_Y < 95);
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
