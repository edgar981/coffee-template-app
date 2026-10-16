import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  preguntaCompleta,
  preguntasCompletas,
  agruparPreguntas,
  normalizarBusqueda,
  preguntaCoincide,
  gruposFiltrados,
  totalPreguntas,
  resaltarCoincidencia,
  type PreguntaItem,
} from './preguntas-frecuentes';

const p = (grupo: string, question: string, answer: string): PreguntaItem => ({ grupo, question, answer });

test('preguntaCompleta: los tres campos no vacíos', () => {
  assert.equal(preguntaCompleta(p('Envíos', '¿A dónde envían?', 'A todo Colombia.')), true);
  assert.equal(preguntaCompleta(p('', '¿A dónde envían?', 'A todo Colombia.')), false);
  assert.equal(preguntaCompleta(p('Envíos', '', 'A todo Colombia.')), false);
  assert.equal(preguntaCompleta(p('Envíos', '¿A dónde envían?', '')), false);
  assert.equal(preguntaCompleta(p('  ', '¿A dónde envían?', 'A todo Colombia.')), false);
});

test('preguntasCompletas: descarta las filas a medias, conserva el orden', () => {
  const items = [p('Envíos', 'q1', 'a1'), p('', 'q2', ''), p('Pagos', 'q3', 'a3')];
  assert.deepEqual(preguntasCompletas(items), [p('Envíos', 'q1', 'a1'), p('Pagos', 'q3', 'a3')]);
});

test('agruparPreguntas: sin preguntas, cero grupos (hide-on-empty)', () => {
  assert.deepEqual(agruparPreguntas([]), []);
});

test('agruparPreguntas: un grupo con sólo filas incompletas no aparece', () => {
  assert.deepEqual(agruparPreguntas([p('Envíos', '', 'a1'), p('Envíos', 'q2', '')]), []);
});

test('agruparPreguntas: agrupa por EL CAMPO grupo, orden de PRIMERA aparición', () => {
  const items = [
    p('Envíos', '¿A dónde envían?', 'A todo Colombia.'),
    p('Pagos', '¿Cómo pago?', 'Nequi o transferencia.'),
    p('Envíos', '¿Cuánto cuesta?', 'Desde $9.000.'),
    p('Pagos', '¿Es seguro?', 'Sí, vía Wompi.'),
  ];
  assert.deepEqual(agruparPreguntas(items), [
    { grupo: 'Envíos', items: [items[0], items[2]] },
    { grupo: 'Pagos', items: [items[1], items[3]] },
  ]);
});

test('agruparPreguntas: comparación EXACTA — "Envíos" y "envíos" NO son el mismo grupo', () => {
  const items = [p('Envíos', 'q1', 'a1'), p('envíos', 'q2', 'a2')];
  assert.deepEqual(agruparPreguntas(items).map((g) => g.grupo), ['Envíos', 'envíos']);
});

test('normalizarBusqueda: quita acentos y mayúsculas', () => {
  assert.equal(normalizarBusqueda('Café Molido'), 'cafe molido');
  assert.equal(normalizarBusqueda('  Nequi  '), 'nequi');
});

test('preguntaCoincide: consulta vacía coincide siempre', () => {
  assert.equal(preguntaCoincide(p('Pagos', '¿Cómo pago?', 'Nequi.'), ''), true);
});

test('preguntaCoincide: busca en la PREGUNTA', () => {
  assert.equal(preguntaCoincide(p('Pagos', '¿Cómo pago con Nequi?', 'Ver instrucciones.'), 'nequi'), true);
});

test('preguntaCoincide: busca también en la RESPUESTA, sin acento ni mayúscula', () => {
  assert.equal(preguntaCoincide(p('El café', '¿Cómo lo guardo?', 'Lejos de la luz y del calor.'), 'CALOR'), true);
  assert.equal(preguntaCoincide(p('El café', '¿Cómo lo guardo?', 'Lejos de la luz y del calor.'), 'molido'), false);
});

test('gruposFiltrados: sin consulta, devuelve todos los grupos e items', () => {
  const grupos = agruparPreguntas([p('Envíos', 'q1', 'a1'), p('Pagos', 'q2', 'a2')]);
  assert.deepEqual(gruposFiltrados(grupos, ''), grupos);
});

test('gruposFiltrados: filtra items por texto y DESCARTA el grupo si queda vacío', () => {
  const grupos = agruparPreguntas([
    p('Envíos', '¿A dónde envían?', 'A todo Colombia.'),
    p('Pagos', '¿Cómo pago?', 'Nequi o transferencia.'),
  ]);
  const filtrado = gruposFiltrados(grupos, 'nequi');
  assert.deepEqual(filtrado, [{ grupo: 'Pagos', items: [p('Pagos', '¿Cómo pago?', 'Nequi o transferencia.')] }]);
});

test('gruposFiltrados: sin ninguna coincidencia, cero grupos', () => {
  const grupos = agruparPreguntas([p('Envíos', '¿A dónde envían?', 'A todo Colombia.')]);
  assert.deepEqual(gruposFiltrados(grupos, 'inexistente'), []);
});

test('totalPreguntas: suma las preguntas de todos los grupos', () => {
  const grupos = agruparPreguntas([p('Envíos', 'q1', 'a1'), p('Envíos', 'q2', 'a2'), p('Pagos', 'q3', 'a3')]);
  assert.equal(totalPreguntas(grupos), 3);
});

test('resaltarCoincidencia: sin consulta, un solo segmento sin resaltar', () => {
  assert.deepEqual(resaltarCoincidencia('¿Cómo pago?', ''), [{ texto: '¿Cómo pago?', resaltado: false }]);
});

test('resaltarCoincidencia: sin coincidencia, un solo segmento sin resaltar', () => {
  assert.deepEqual(resaltarCoincidencia('¿Cómo pago?', 'nequi'), [{ texto: '¿Cómo pago?', resaltado: false }]);
});

test('resaltarCoincidencia: parte el texto en tres segmentos, sin acento ni mayúscula', () => {
  assert.deepEqual(resaltarCoincidencia('¿Cómo pago con Nequi?', 'nequi'), [
    { texto: '¿Cómo pago con ', resaltado: false },
    { texto: 'Nequi', resaltado: true },
    { texto: '?', resaltado: false },
  ]);
});

test('resaltarCoincidencia: coincidencia al INICIO, sin segmento "antes"', () => {
  assert.deepEqual(resaltarCoincidencia('Nequi es rápido', 'nequi'), [
    { texto: 'Nequi', resaltado: true },
    { texto: ' es rápido', resaltado: false },
  ]);
});

test('resaltarCoincidencia: coincidencia al FINAL, sin segmento "después"', () => {
  assert.deepEqual(resaltarCoincidencia('Paga con Nequi', 'nequi'), [
    { texto: 'Paga con ', resaltado: false },
    { texto: 'Nequi', resaltado: true },
  ]);
});
