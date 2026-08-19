import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modeloInforme, MAX_FILAS_INFORME } from './informe';
import { BUSINESS_TZ, dayKeyStart } from '@duna/core/timezone';
import { formatCOP } from '@duna/core/utils';
import type { Payment, MetodoPago } from '@/types/payment';

// Capa 1 — puro. Lo que se afirma acá es lo que hace al informe CONFIABLE, y nada de
// eso necesita generar un PDF: que el alcance sea EXACTAMENTE el de la pantalla, que
// el tope se DECLARE cuando muerde, y que el nombre del archivo diga qué recorte es.

const pago = (i: number, extra: Partial<Payment> = {}): Payment => ({
  id: `p${i}`,
  monto: 1000 + i,
  metodo: 'NEQUI' as MetodoPago,
  fecha: '2026-08-14T15:00:00.000Z',
  referencia: `REF-${i}`,
  registrado_por_nombre: 'Ana',
  order: { numero_orden: `CN-${100000 + i}`, cliente_nombre: 'Laura Cárdenas' },
  ...extra,
} as unknown as Payment);

const AHORA = dayKeyStart('2026-08-19', BUSINESS_TZ);
const base = {
  negocio: 'Café Nayoli', ahora: AHORA,
  desde: '2026-08-01', hasta: '2026-08-19',
  metodoLabel: null, metodosDelFiltro: null, mejorDia: null,
};
/** Por defecto el desglose ve lo mismo que el detalle (sin filtro de método). */
const conPagos = (pagos: Payment[], extra: Record<string, unknown> = {}) =>
  modeloInforme({ ...base, pagos, enBucket: pagos, ...extra });

test('el alcance es el de la pantalla: ni re-filtra ni re-ordena', () => {
  const pagos = [pago(3), pago(1), pago(2)];
  const m = conPagos(pagos);
  assert.equal(m.filas.length, 3);
  // El MISMO orden en que llegaron — las primeras del libro son las del informe.
  assert.deepEqual(m.filas.map(f => f.orden), ['CN-100003', 'CN-100001', 'CN-100002']);
});

test('el RESUMEN lleva total, pagos y promedio — la frase en forma de bloque', () => {
  const m = conPagos([pago(1), pago(3)]); // 1001 + 1003 = 2004
  assert.deepEqual(m.resumen.map(d => d.label), ['Total', 'Pagos', 'Promedio por pago']);
  assert.equal(m.resumen[1].valor, '2');
  assert.equal(m.resumen[2].valor, formatCOP(1002));
});

test('bajo el tope NO hay nota: un informe completo no declara nada', () => {
  const m = conPagos(Array.from({ length: MAX_FILAS_INFORME }, (_, i) => pago(i)));
  assert.equal(m.filas.length, MAX_FILAS_INFORME);
  assert.equal(m.nota, null);
});

test('pasado el tope CORTA y lo DECLARA con el texto exacto', () => {
  const m = conPagos(Array.from({ length: MAX_FILAS_INFORME + 1 }, (_, i) => pago(i)));
  assert.equal(m.filas.length, MAX_FILAS_INFORME);
  assert.equal(m.nota,
    'Se alcanzó el máximo de 1.000 filas en el detalle: el rango contiene más. '
    + 'El resumen y el desglose por método sí cubren el período completo.');
  // Conserva las PRIMERAS, no un recorte arbitrario.
  assert.equal(m.filas[0].orden, 'CN-100000');
});

test('un dato ausente imprime "—", igual que el libro — nunca una celda vacía', () => {
  const m = conPagos([pago(1, { order: null, referencia: '' } as Partial<Payment>)]);
  assert.equal(m.filas[0].orden, '—');
  assert.equal(m.filas[0].cliente, '—');
  assert.equal(m.filas[0].referencia, '—');
});

test('el nombre del archivo dice QUÉ recorte es, y el método va sin acentos', () => {
  assert.equal(conPagos([]).nombreArchivo,
    'pagos-2026-08-01_2026-08-19.pdf');
  assert.equal(conPagos([], { metodoLabel: 'Crédito Ñandú' }).nombreArchivo,
    'pagos-credito-nandu-2026-08-01_2026-08-19.pdf');
});

test('el título lleva el rango, y el método SÓLO si filtra', () => {
  assert.equal(conPagos([]).titulo, 'PAGOS · 1 ago 2026 – 19 ago 2026');
  assert.equal(conPagos([], { metodoLabel: 'Nequi' }).titulo,
    'PAGOS · 1 ago 2026 – 19 ago 2026 · Nequi');
});

test('el monto de la columna va a la DERECHA, como en el libro', () => {
  const cols = conPagos([]).columnas;
  assert.deepEqual(cols.filter(c => c.derecha).map(c => c.titulo), ['Monto']);
});

// ── EL DESGLOSE POR MÉTODO ──────────────────────────────────────────────────
// La corrección que separa un documento de un volcado: en pantalla el operador
// puede quitar el filtro y ver el contexto; en un PDF NO puede. Por eso el
// desglose muestra el período COMPLETO aunque el select filtre, y se resuelve
// ETIQUETANDO (bajada + fila en negrita), no ocultando.

const pagoDe = (metodo: MetodoPago, monto: number): Payment =>
  pago(0, { metodo, monto } as Partial<Payment>);

test('el desglose sale del período COMPLETO, no del detalle filtrado', () => {
  const enBucket = [pagoDe('NEQUI', 60), pagoDe('EFECTIVO', 40)];
  const soloNequi = enBucket.filter(p => p.metodo === 'NEQUI');
  const m = modeloInforme({
    ...base, pagos: soloNequi, enBucket,
    metodoLabel: 'Nequi', metodosDelFiltro: ['NEQUI'],
  });
  // El detalle y el resumen son del filtro…
  assert.equal(m.filas.length, 1);
  assert.equal(m.resumen[0].valor, formatCOP(60));
  // …pero el desglose ve los 100 del período: es lo único que dice que hay más
  // plata fuera del número del resumen.
  const nequi = m.porMetodo.find(f => f.metodo === 'Nequi')!;
  const efectivo = m.porMetodo.find(f => f.metodo === 'Efectivo')!;
  assert.equal(nequi.total, formatCOP(60));
  assert.equal(efectivo.total, formatCOP(40));
  assert.equal(nequi.participacion, '60 %');
  assert.equal(efectivo.participacion, '40 %');
});

test('con filtro: la bajada NOMBRA el método y la fila va marcada', () => {
  const enBucket = [pagoDe('NEQUI', 60), pagoDe('EFECTIVO', 40)];
  const m = modeloInforme({
    ...base, pagos: [enBucket[0]], enBucket,
    metodoLabel: 'Nequi', metodosDelFiltro: ['NEQUI'],
  });
  assert.equal(m.bajadaMetodo,
    'Del período completo, sin el filtro de método. El detalle de abajo desarrolla sólo Nequi.');
  assert.deepEqual(m.porMetodo.filter(f => f.marcado).map(f => f.metodo), ['Nequi']);
});

test('un filtro de GRUPO marca TODAS sus filas, no una', () => {
  // "Cualquier digital" abarca tres métodos: marcar una sola mentiría sobre qué
  // desarrolla el detalle.
  const enBucket = [pagoDe('NEQUI', 30), pagoDe('DAVIPLATA', 20), pagoDe('TRANSFERENCIA', 10), pagoDe('EFECTIVO', 40)];
  const m = modeloInforme({
    ...base, pagos: enBucket.slice(0, 3), enBucket,
    metodoLabel: 'medios digitales', metodosDelFiltro: ['NEQUI', 'DAVIPLATA', 'TRANSFERENCIA'],
  });
  assert.deepEqual(m.porMetodo.filter(f => f.marcado).map(f => f.metodo).sort(),
    ['Daviplata', 'Nequi', 'Transferencia']);
});

test('SIN filtro no hay bajada: desglose y detalle cubren lo mismo', () => {
  const m = conPagos([pagoDe('NEQUI', 10)]);
  assert.equal(m.bajadaMetodo, null);
  assert.deepEqual(m.porMetodo.filter(f => f.marcado), []);
});

test('el desglose lista los CINCO métodos, de mayor a menor', () => {
  const m = conPagos([pagoDe('OTRO', 5), pagoDe('EFECTIVO', 50)]);
  assert.equal(m.porMetodo.length, 5, 'los cinco, aunque tres estén en cero');
  assert.equal(m.porMetodo[0].metodo, 'Efectivo');
  assert.equal(m.porMetodo[1].metodo, 'Otro');
  // Un método sin movimiento vale 0, no desaparece: "no entró nada por ahí" es un dato.
  assert.equal(m.porMetodo[4].total, formatCOP(0));
});

test('sin plata en el período la participación CALLA en vez de dividir por cero', () => {
  const m = conPagos([]);
  assert.deepEqual([...new Set(m.porMetodo.map(f => f.participacion))], ['—']);
});

// ── LOS METADATOS DEL DOCUMENTO ─────────────────────────────────────────────

test('la cabecera lleva negocio y fecha de generación; el pie se explica solo', () => {
  const m = conPagos([pago(1)]);
  assert.equal(m.negocio, 'Café Nayoli');
  assert.match(m.generado, /^generado el 19 ago 2026, /);
  // Una hoja suelta impresa tiene que decir de qué es: negocio + rango en CADA página.
  assert.equal(m.pie, 'Café Nayoli · Pagos 1 ago 2026 – 19 ago 2026');
});
