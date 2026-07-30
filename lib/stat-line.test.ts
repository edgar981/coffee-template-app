import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStatLine } from './stat-line';

// El slot único de las stat cards. El caso crítico es el scope: tiene que
// sobrevivir a cualquier línea que gane, porque de eso depende que "Por cobrar $0"
// no se lea como "hoy no hay nada por cobrar".

test('el insight gana el slot cuando existe', () => {
  assert.deepEqual(
    resolveStatLine({ insight: '3 meses consecutivos al alza', sub: 'Mes en curso' }),
    { text: '3 meses consecutivos al alza', enfasis: false },
  );
});

test('sin insight se muestra el sub', () => {
  assert.deepEqual(
    resolveStatLine({ sub: 'Productos bajo mínimo' }),
    { text: 'Productos bajo mínimo', enfasis: false },
  );
});

test('sin insight ni sub no hay segunda línea', () => {
  assert.equal(resolveStatLine({}), null);
  assert.equal(resolveStatLine({ sub: '' }), null);
  assert.equal(resolveStatLine({ insight: '   ' }), null);
});

test('el scope se apende al SUB cuando el sub gana', () => {
  assert.deepEqual(
    resolveStatLine({ sub: 'Nada por cobrar', scopeSuffix: 'acumulado' }),
    { text: 'Nada por cobrar (acumulado)', enfasis: false },
  );
});

test('el scope se apende al INSIGHT cuando el insight gana (no se pierde)', () => {
  // El caso que el mecanismo existe para prevenir: si esta tarjeta gana un insight
  // en el futuro, el "(acumulado)" tiene que seguir ahí.
  assert.deepEqual(
    resolveStatLine({ insight: 'Ninguna despachada', sub: 'Nada por cobrar', scopeSuffix: 'acumulado' }),
    { text: 'Ninguna despachada (acumulado)', enfasis: false },
  );
});

test('el scope NO se emite solo (sin línea base no dice nada)', () => {
  assert.equal(resolveStatLine({ scopeSuffix: 'acumulado' }), null);
});

test('el énfasis es del insight; un sub que gana el slot va suave', () => {
  assert.equal(resolveStatLine({ insight: 'Racha', insightEnfasis: true })?.enfasis, true);
  assert.equal(resolveStatLine({ sub: 'Descriptivo', insightEnfasis: true })?.enfasis, false);
});

test('scope vacío o en blanco no agrega paréntesis', () => {
  assert.deepEqual(
    resolveStatLine({ sub: 'Sin pago registrado', scopeSuffix: '  ' }),
    { text: 'Sin pago registrado', enfasis: false },
  );
});
