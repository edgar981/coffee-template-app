import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modeloInforme, MAX_FILAS_INFORME } from './informe';
import type { Frase } from './frase';
import type { Payment } from '@/types/payment';

// Capa 1 — puro. Lo que se afirma acá es lo que hace al informe CONFIABLE, y nada de
// eso necesita generar un PDF: que el alcance sea EXACTAMENTE el de la pantalla, que
// el tope se DECLARE cuando muerde, y que el nombre del archivo diga qué recorte es.

const frase: Frase = {
  eyebrow: '1 ago – 19 ago',
  tramos: [{ t: 'Este mes entraron ' }, { t: '$ 315.000', fuerte: true },
           { t: ' en ' }, { t: '11 pagos', fuerte: true }, { t: '.' }],
  subtitulo: 'Promedio de $ 28.636 por pago.',
};

const pago = (i: number, extra: Partial<Payment> = {}): Payment => ({
  id: `p${i}`,
  monto: 1000 + i,
  metodo: 'NEQUI',
  fecha: '2026-08-14T15:00:00.000Z',
  referencia: `REF-${i}`,
  registrado_por_nombre: 'Ana',
  order: { numero_orden: `CN-${100000 + i}`, cliente_nombre: 'Laura Cárdenas' },
  ...extra,
} as unknown as Payment);

const base = { frase, desde: '2026-08-01', hasta: '2026-08-19', metodoLabel: null, total: 315_000 };

test('el alcance es el de la pantalla: ni re-filtra ni re-ordena', () => {
  const pagos = [pago(3), pago(1), pago(2)];
  const m = modeloInforme({ ...base, pagos });
  assert.equal(m.filas.length, 3);
  // El MISMO orden en que llegaron — las primeras del libro son las del informe.
  assert.deepEqual(m.filas.map(f => f.orden), ['CN-100003', 'CN-100001', 'CN-100002']);
});

test('el encabezado ES la frase de la pantalla, en texto plano', () => {
  const m = modeloInforme({ ...base, pagos: [pago(1)] });
  assert.equal(m.titulo, 'Este mes entraron $ 315.000 en 11 pagos.');
  assert.equal(m.subtitulo, 'Promedio de $ 28.636 por pago.');
});

test('bajo el tope NO hay nota: un informe completo no declara nada', () => {
  const m = modeloInforme({ ...base, pagos: Array.from({ length: MAX_FILAS_INFORME }, (_, i) => pago(i)) });
  assert.equal(m.filas.length, MAX_FILAS_INFORME);
  assert.equal(m.nota, null);
});

test('pasado el tope CORTA y lo DECLARA con el texto exacto', () => {
  const m = modeloInforme({ ...base, pagos: Array.from({ length: MAX_FILAS_INFORME + 1 }, (_, i) => pago(i)) });
  assert.equal(m.filas.length, MAX_FILAS_INFORME);
  assert.equal(m.nota, 'Se alcanzó el máximo de 1.000 filas: el rango contiene más.');
  // Conserva las PRIMERAS, no un recorte arbitrario.
  assert.equal(m.filas[0].orden, 'CN-100000');
});

test('un dato ausente imprime "—", igual que el libro — nunca una celda vacía', () => {
  const m = modeloInforme({ ...base, pagos: [pago(1, { order: null, referencia: '' } as Partial<Payment>)] });
  assert.equal(m.filas[0].orden, '—');
  assert.equal(m.filas[0].cliente, '—');
  assert.equal(m.filas[0].referencia, '—');
});

test('el nombre del archivo dice QUÉ recorte es, y el método va sin acentos', () => {
  assert.equal(modeloInforme({ ...base, pagos: [] }).nombreArchivo,
    'pagos-2026-08-01_2026-08-19.pdf');
  assert.equal(modeloInforme({ ...base, pagos: [], metodoLabel: 'Crédito Ñandú' }).nombreArchivo,
    'pagos-credito-nandu-2026-08-01_2026-08-19.pdf');
});

test('la meta lleva el rango, y el método SÓLO si filtra', () => {
  assert.equal(modeloInforme({ ...base, pagos: [] }).meta, '1 ago 2026 – 19 ago 2026');
  assert.equal(modeloInforme({ ...base, pagos: [], metodoLabel: 'Nequi' }).meta,
    '1 ago 2026 – 19 ago 2026 · Nequi');
});

test('el monto de la columna va a la DERECHA, como en el libro', () => {
  const cols = modeloInforme({ ...base, pagos: [] }).columnas;
  assert.deepEqual(cols.filter(c => c.derecha).map(c => c.titulo), ['Monto']);
});
