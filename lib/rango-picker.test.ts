import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangoTrasClic } from './rango-picker';

// Capa 1 — puro. El caso que estaba EN PRODUCCIÓN: con un rango ya elegido, cada clic
// se interpretaba como la fecha FINAL y el operador no podía elegir otro rango sin
// limpiar filtros. El test corre contra la SUGERENCIA DE LA LIBRERÍA tal cual, que es
// la que produce el defecto: sin el mecanismo, estos casos fallan.

const completo = { desde: '2026-08-01', hasta: '2026-08-19' };

test('rango COMPLETO + clic = rango NUEVO desde ese día, no un final movido', () => {
  // Lo que propone react-day-picker con un rango completo (medido con `addToRange`):
  // conserva el `from` viejo y mueve el `to` al día clickeado.
  const sugeridoPorRDP = { desde: '2026-08-01', hasta: '2026-08-16' };
  assert.deepEqual(
    rangoTrasClic(completo, sugeridoPorRDP, '2026-08-16'),
    { desde: '2026-08-16', hasta: null },
    'el clic tiene que ABRIR un rango nuevo, no re-interpretar el final del viejo',
  );
});

test('el segundo clic SÍ cierra el rango: sobre uno incompleto manda la librería', () => {
  const aMedias = { desde: '2026-08-16', hasta: null };
  const sugeridoPorRDP = { desde: '2026-08-16', hasta: '2026-08-17' };
  assert.deepEqual(rangoTrasClic(aMedias, sugeridoPorRDP, '2026-08-17'), sugeridoPorRDP);
});

test('sin rango previo manda la librería — ahí ya hacía lo correcto', () => {
  const vacio = { desde: null, hasta: null };
  const sugeridoPorRDP = { desde: '2026-08-16', hasta: '2026-08-16' };
  assert.deepEqual(rangoTrasClic(vacio, sugeridoPorRDP, '2026-08-16'), sugeridoPorRDP);
});

test('limpiar la selección (sin día clickeado) pasa tal cual', () => {
  assert.deepEqual(
    rangoTrasClic(completo, { desde: null, hasta: null }, null),
    { desde: null, hasta: null },
  );
});

test('un rango a medias NO se re-abre: sólo el completo dispara la regla', () => {
  // Con `desde` puesto y `hasta` vacío el operador está EN MEDIO de elegir; tratar ese
  // clic como "empezar de nuevo" haría imposible cerrar el rango.
  const aMedias = { desde: '2026-08-16', hasta: null };
  const r = rangoTrasClic(aMedias, { desde: '2026-08-16', hasta: '2026-08-20' }, '2026-08-20');
  assert.equal(r.hasta, '2026-08-20', 'el segundo clic cierra, no reinicia');
});
