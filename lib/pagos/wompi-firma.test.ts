import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  verificarFirmaWompi,
  RutaDePropertyNoResuelveError,
  pesosACentavos,
  firmarIntegridadWompi,
  type EventoWompi,
} from './wompi-firma';

// Capa 1 — puro. El verificador de firma de eventos de Wompi.
//
// El caso dorado se calcula ACÁ, con la fórmula (concatenación plana de los valores
// que `signature.properties` lista, en ese orden, + timestamp + secreto → sha256
// hex), NUNCA copiado del ejemplo numérico de la doc de Wompi — está medido que ese
// ejemplo no reproduce (ver el comentario de cabecera de `wompi-firma.ts`).

const SECRETO = 'secreto-de-prueba-inventado-para-el-test';

/** Calcula el checksum esperado con la MISMA fórmula, para construir el caso
 * dorado sin depender de la implementación ni de la doc. */
function checksumEsperado(data: Record<string, unknown>, properties: string[], timestamp: number | string, secreto: string): string {
  const resolver = (ruta: string): string => {
    const valor = ruta.split('.').reduce<unknown>((acc, parte) => (acc as Record<string, unknown>)?.[parte], data);
    return String(valor);
  };
  const cadena = properties.map(resolver).join('') + String(timestamp) + secreto;
  return createHash('sha256').update(cadena).digest('hex');
}

const DATA_BASE = {
  transaccion: { id: 'txn_test_123', estado: 'APPROVED', monto: 500_000 },
  cliente: { email: 'cliente@ejemplo.com' },
};
const PROPERTIES_BASE = ['transaccion.id', 'transaccion.estado', 'transaccion.monto'];
const TIMESTAMP_BASE = 1_699_999_999;

function eventoBase(overrides: Partial<EventoWompi> = {}): EventoWompi {
  const checksum = checksumEsperado(DATA_BASE, PROPERTIES_BASE, TIMESTAMP_BASE, SECRETO);
  return {
    data: DATA_BASE,
    timestamp: TIMESTAMP_BASE,
    signature: { properties: PROPERTIES_BASE, checksum },
    ...overrides,
  };
}

test('firma válida → true', () => {
  assert.equal(verificarFirmaWompi(eventoBase(), SECRETO), true);
});

test('firma inválida (un carácter cambiado) → false', () => {
  const evento = eventoBase();
  const checksumAlterado = evento.signature.checksum.slice(0, -1) + (evento.signature.checksum.at(-1) === 'a' ? 'b' : 'a');
  const roto = { ...evento, signature: { ...evento.signature, checksum: checksumAlterado } };
  assert.equal(verificarFirmaWompi(roto, SECRETO), false);
});

test('EL ORDEN de `properties` importa: mismos campos, otro orden → otro checksum', () => {
  const ordenInvertido = [...PROPERTIES_BASE].reverse();
  const checksumInvertido = checksumEsperado(DATA_BASE, ordenInvertido, TIMESTAMP_BASE, SECRETO);
  assert.notEqual(checksumInvertido, eventoBase().signature.checksum);

  // Un evento que declara el orden invertido y trae el checksum calculado para ESE
  // orden verifica bien — la función lee `properties` del evento, no asume el orden.
  const evento = eventoBase({ signature: { properties: ordenInvertido, checksum: checksumInvertido } });
  assert.equal(verificarFirmaWompi(evento, SECRETO), true);

  // Y el checksum del orden "normal" ya NO calza con el orden invertido declarado.
  const mismoOrdenChecksumViejo = { ...evento, signature: { ...evento.signature, checksum: eventoBase().signature.checksum } };
  assert.equal(verificarFirmaWompi(mismoOrdenChecksumViejo, SECRETO), false);
});

test('un `properties` con campos DISTINTOS del ejemplo típico sigue funcionando — no hay lista fija hardcodeada', () => {
  const properties = ['cliente.email']; // nada que ver con transaction.id/status/amount_in_cents
  const checksum = checksumEsperado(DATA_BASE, properties, TIMESTAMP_BASE, SECRETO);
  const evento = eventoBase({ signature: { properties, checksum } });
  assert.equal(verificarFirmaWompi(evento, SECRETO), true);
});

test('el TIMESTAMP participa: cambiarlo cambia el hash y rompe la verificación', () => {
  const evento = eventoBase({ timestamp: TIMESTAMP_BASE + 1 });
  assert.equal(verificarFirmaWompi(evento, SECRETO), false);
});

test('una ruta que NO RESUELVE lanza RutaDePropertyNoResuelveError — campo ausente', () => {
  const evento = eventoBase({ signature: { properties: ['transaccion.no_existe'], checksum: 'x'.repeat(64) } });
  assert.throws(() => verificarFirmaWompi(evento, SECRETO), RutaDePropertyNoResuelveError);
});

test('una ruta que resuelve a `null` lanza — no se rellena con un valor inventado', () => {
  const data = { transaccion: { id: 'txn_1', estado: null } };
  const evento = eventoBase({ data, signature: { properties: ['transaccion.estado'], checksum: 'x'.repeat(64) } });
  assert.throws(() => verificarFirmaWompi(evento, SECRETO), RutaDePropertyNoResuelveError);
});

test('una ruta que resuelve a un OBJETO (no un escalar) lanza', () => {
  const evento = eventoBase({ signature: { properties: ['transaccion'], checksum: 'x'.repeat(64) } });
  assert.throws(() => verificarFirmaWompi(evento, SECRETO), RutaDePropertyNoResuelveError);
});

test('LARGOS DISTINTOS en la comparación no explotan: devuelve false', () => {
  const evento = eventoBase();
  // El checksum del header es más corto que el del cuerpo — timingSafeEqual
  // lanzaría con Buffers de largo distinto si no se manejara antes.
  assert.equal(verificarFirmaWompi(evento, SECRETO, 'abc123'), false);
});

test('checksum del HEADER que difiere del checksum del CUERPO → inválido (fail closed), aunque el del cuerpo sea correcto', () => {
  const evento = eventoBase();
  const headerDistinto = 'f'.repeat(64);
  assert.notEqual(headerDistinto, evento.signature.checksum);
  assert.equal(verificarFirmaWompi(evento, SECRETO, headerDistinto), false);
});

test('checksum del HEADER que COINCIDE con el del cuerpo → sigue verificando normalmente', () => {
  const evento = eventoBase();
  assert.equal(verificarFirmaWompi(evento, SECRETO, evento.signature.checksum), true);
});

test('secreto equivocado → false, aunque todo lo demás sea correcto', () => {
  assert.equal(verificarFirmaWompi(eventoBase(), 'otro-secreto-distinto'), false);
});

// ── pesosACentavos ────────────────────────────────────────────────────────────

test('pesosACentavos: un monto entero de pesos da el entero de centavos esperado', () => {
  assert.equal(pesosACentavos(25_000), 2_500_000);
  assert.equal(pesosACentavos(0), 0);
});

test('pesosACentavos: EXHIBE la trampa — truncar 4.35*100 daría 434, no 435', () => {
  // Medido: en JS, 4.35 * 100 === 434.99999999999994. Un `Math.trunc` (o `| 0`)
  // de ese valor da 434 — un centavo MENOS del monto real. Esta es la aserción
  // que un `Math.trunc` haría fallar y `Math.round` no.
  assert.equal(Math.trunc(4.35 * 100), 434); // el bug que NO queremos
  assert.equal(pesosACentavos(4.35), 435);
});

test('pesosACentavos: el mismo defecto con 19.99 (1998.9999999999998 en JS)', () => {
  assert.equal(Math.trunc(19.99 * 100), 1998); // el bug que NO queremos
  assert.equal(pesosACentavos(19.99), 1999);
});

// ── firmarIntegridadWompi ──────────────────────────────────────────────────────

const SECRETO_INTEGRIDAD = 'secreto-de-integridad-inventado-para-el-test';

/** Calcula el checksum esperado con la MISMA fórmula, sin depender de la
 *  implementación — mismo método que `checksumEsperado` arriba, para la otra firma. */
function checksumIntegridadEsperado(
  reference: string,
  amountInCents: number,
  currency: string,
  secreto: string,
): string {
  const cadena = reference + String(amountInCents) + currency + secreto;
  return createHash('sha256').update(cadena).digest('hex');
}

test('firmarIntegridadWompi: produce el sha256 de la concatenación plana reference+monto+moneda+secreto', () => {
  const esperado = checksumIntegridadEsperado('CN-123456:cuid_abc', 2_500_000, 'COP', SECRETO_INTEGRIDAD);
  assert.equal(firmarIntegridadWompi('CN-123456:cuid_abc', 2_500_000, 'COP', SECRETO_INTEGRIDAD), esperado);
});

test('firmarIntegridadWompi: cambiar la referencia cambia la firma', () => {
  const a = firmarIntegridadWompi('CN-1:x', 1000, 'COP', SECRETO_INTEGRIDAD);
  const b = firmarIntegridadWompi('CN-2:x', 1000, 'COP', SECRETO_INTEGRIDAD);
  assert.notEqual(a, b);
});

test('firmarIntegridadWompi: cambiar el monto en centavos cambia la firma', () => {
  const a = firmarIntegridadWompi('CN-1:x', 1000, 'COP', SECRETO_INTEGRIDAD);
  const b = firmarIntegridadWompi('CN-1:x', 1001, 'COP', SECRETO_INTEGRIDAD);
  assert.notEqual(a, b);
});

test('firmarIntegridadWompi: cambiar la moneda cambia la firma', () => {
  const a = firmarIntegridadWompi('CN-1:x', 1000, 'COP', SECRETO_INTEGRIDAD);
  const b = firmarIntegridadWompi('CN-1:x', 1000, 'USD', SECRETO_INTEGRIDAD);
  assert.notEqual(a, b);
});

test('firmarIntegridadWompi: secreto equivocado → firma distinta', () => {
  const a = firmarIntegridadWompi('CN-1:x', 1000, 'COP', SECRETO_INTEGRIDAD);
  const b = firmarIntegridadWompi('CN-1:x', 1000, 'COP', 'otro-secreto');
  assert.notEqual(a, b);
});

test('firmarIntegridadWompi: EL ORDEN de la concatenación es reference+monto+moneda+secreto, no otro', () => {
  const reference = 'CN-1:x';
  const cents = 1000;
  const currency = 'COP';
  // La cadena en el orden CORRECTO (lo que la función debe producir) contra la
  // cadena con el monto y la referencia INVERTIDOS — mismos cuatro valores,
  // otro orden, otro hash. Si la implementación alguna vez concatenara en otro
  // orden, este test lo delata donde los tests de "cambiar un campo" no pueden
  // (esos sólo prueban que el campo PARTICIPA, no en qué posición).
  const ordenInvertido = createHash('sha256')
    .update(String(cents) + reference + currency + SECRETO_INTEGRIDAD)
    .digest('hex');
  assert.notEqual(firmarIntegridadWompi(reference, cents, currency, SECRETO_INTEGRIDAD), ordenInvertido);
});
