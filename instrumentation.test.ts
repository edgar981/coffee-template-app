import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  verificarLlavePasarelaCoherente,
  PREFIJO_LLAVE_PASARELA_PRODUCTIVA,
} from './instrumentation';

// Lista negra, no lista blanca (decisión del owner, ver instrumentation.ts): sólo se
// rechaza el único prefijo confirmado como productivo; cualquier otro valor pasa.

test('llave productiva en un despliegue DEMO → rechaza', () => {
  const v = verificarLlavePasarelaCoherente(true, `${PREFIJO_LLAVE_PASARELA_PRODUCTIVA}abc123`);
  assert.equal(v.ok, false);
  if (!v.ok) {
    assert.match(v.mensaje, /WOMPI_PUBLIC_KEY/);
    assert.doesNotMatch(v.mensaje, new RegExp(`${PREFIJO_LLAVE_PASARELA_PRODUCTIVA}abc123`));
  }
});

test('cualquier otra llave (sandbox u otra convención) en demo → pasa', () => {
  assert.deepEqual(verificarLlavePasarelaCoherente(true, 'pub_test_abc123'), { ok: true });
  assert.deepEqual(verificarLlavePasarelaCoherente(true, 'pub_sandbox_abc123'), { ok: true });
  assert.deepEqual(verificarLlavePasarelaCoherente(true, 'algo-que-no-empieza-igual'), {
    ok: true,
  });
});

test('sin llave configurada → pasa, sin importar si es demo', () => {
  assert.deepEqual(verificarLlavePasarelaCoherente(true, undefined), { ok: true });
  assert.deepEqual(verificarLlavePasarelaCoherente(false, undefined), { ok: true });
});

test('producción real con llave productiva → pasa (caso legítimo)', () => {
  assert.deepEqual(
    verificarLlavePasarelaCoherente(false, `${PREFIJO_LLAVE_PASARELA_PRODUCTIVA}abc123`),
    { ok: true },
  );
});
