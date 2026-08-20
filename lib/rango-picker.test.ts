import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avanzarSeleccion } from './rango-picker';

// Capa 1 — puro. La regla del rango en dos clics: el primero ARRANCA (no emite), el
// segundo COMPLETA (emite ordenado). El estado a medias no sale de acá.
//
// El defecto que este modelo cierra: la versión anterior (`rangoTrasClic`) devolvía un
// `to: null` que RDP nunca produce, y ese medio-rango se derramaba a los consumidores.
// El discriminador de estos tests es que el primer clic NO emite y el segundo ordena.

test('primer clic ARRANCA: guarda el ancla, no completa', () => {
  const paso = avanzarSeleccion(null, '2026-08-16');
  assert.deepEqual(paso, { fase: 'arranca', pendiente: '2026-08-16' });
});

test('segundo clic COMPLETA el rango', () => {
  const paso = avanzarSeleccion('2026-08-16', '2026-08-20');
  assert.deepEqual(paso, { fase: 'completa', desde: '2026-08-16', hasta: '2026-08-20' });
});

test('el segundo clic ANTES del ancla se ordena — "del 20 al 16" es válido', () => {
  const paso = avanzarSeleccion('2026-08-20', '2026-08-16');
  assert.deepEqual(paso, { fase: 'completa', desde: '2026-08-16', hasta: '2026-08-20' });
});

test('dos clics en el MISMO día = rango de un día, completo', () => {
  const paso = avanzarSeleccion('2026-08-16', '2026-08-16');
  assert.deepEqual(paso, { fase: 'completa', desde: '2026-08-16', hasta: '2026-08-16' });
});

test('un clic sobre un rango recién completado ARRANCA otro — el bug original', () => {
  // Tras completar, el picker pone `pendiente` en null. El siguiente clic empieza de
  // cero en vez de mover el final del rango viejo, que era justo lo imposible antes.
  const completa = avanzarSeleccion('2026-08-16', '2026-08-20');
  assert.equal(completa.fase, 'completa');
  const siguiente = avanzarSeleccion(null, '2026-09-01');
  assert.deepEqual(siguiente, { fase: 'arranca', pendiente: '2026-09-01' });
});

test('el orden cronológico sale de la comparación de day keys (lexicográfica)', () => {
  // Cruzando meses y años, para que no se cuele un compare numérico frágil.
  assert.deepEqual(
    avanzarSeleccion('2026-01-05', '2025-12-30'),
    { fase: 'completa', desde: '2025-12-30', hasta: '2026-01-05' },
  );
});
