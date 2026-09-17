import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarRespuestaOtroMetodo } from './interpretar-respuesta-otro-metodo';

// CHECKOUT-NEQUI-EXITO-FIX-1: afirma la lógica de respuesta que
// `FormularioOtroMetodoPasarela.tsx` consulta. Visto fallar CONTRA EL DEFECTO ORIGINAL —
// `body?.error` a secas, cayendo siempre a "error" cuando `body.tipo === 'creada'` no se
// miraba— antes de existir esta función: el caso 'con la respuesta de ÉXITO' fallaba (el
// código viejo habría clasificado el éxito como error, porque nunca miraba `tipo`).
//
// GATE — LÍMITE MEDIDO Y DECLARADO: `npm test` (`package.json:14`) globa sólo `lib/**`,
// `constants/**`, `packages/core/**` y `app/**/*.test.ts` — NO `components/**`. Este archivo
// vive en `components/storefront/checkout/` porque el `touches:` de este slice está acotado a
// ese directorio (no incluye `lib/pagos/` ni `package.json`), así que **este test NO lo corre
// `npm run gate`** hoy. Se verificó corriéndolo DIRECTO:
// `node --import tsx --test "components/storefront/checkout/interpretar-respuesta-otro-metodo.test.ts"`.
// Anotado como open_followup del reporte (`GATE-GLOB-COMPONENTS-TEST-1`) — no se resuelve acá:
// mover el archivo a `lib/pagos/` o ensanchar el glob de `npm test` son cambios fuera de
// `touches`.

const MENSAJE_GENERICO = 'No pudimos procesar tu pago. Intenta de nuevo o usa otro método.';

test('con la respuesta de ÉXITO (tipo: creada) → clasifica éxito, nunca error', () => {
  const resultado = interpretarRespuestaOtroMetodo(
    { tipo: 'creada', id: 'txn_1', status: 'PENDING', autenticacion3ds: 'sin_friccion' },
    MENSAJE_GENERICO,
  );
  assert.deepEqual(resultado, { tipo: 'exito', resultado3ds: 'sin_friccion', desafioHtml: null });
});

test('éxito sin autenticacion3ds del proveedor → cae a "desconocido", no a error', () => {
  const resultado = interpretarRespuestaOtroMetodo({ tipo: 'creada', id: 'txn_2', status: 'PENDING' }, MENSAJE_GENERICO);
  assert.deepEqual(resultado, { tipo: 'exito', resultado3ds: 'desconocido', desafioHtml: null });
});

test('éxito con desafioHtml vacío → se sanea a null, igual que el molde de tarjeta', () => {
  const resultado = interpretarRespuestaOtroMetodo(
    { tipo: 'creada', id: 'txn_3', status: 'PENDING', autenticacion3ds: 'desafio', desafioHtml: '   ' },
    MENSAJE_GENERICO,
  );
  assert.deepEqual(resultado, { tipo: 'exito', resultado3ds: 'desafio', desafioHtml: null });
});

test('un rechazo (firma_invalida) → muestra su propio error del servidor', () => {
  const resultado = interpretarRespuestaOtroMetodo(
    { tipo: 'firma_invalida', error: 'La firma no coincide.' },
    MENSAJE_GENERICO,
  );
  assert.deepEqual(resultado, { tipo: 'error', mensaje: 'La firma no coincide.' });
});

test('un rechazo (otro_fallo) sin mensaje del servidor → cae al genérico', () => {
  const resultado = interpretarRespuestaOtroMetodo({ tipo: 'otro_fallo' }, MENSAJE_GENERICO);
  assert.deepEqual(resultado, { tipo: 'error', mensaje: MENSAJE_GENERICO });
});

test('el rechazo por método no habilitado → su camino propio, no aplanado contra "error"', () => {
  const resultado = interpretarRespuestaOtroMetodo(
    { tipo: 'metodo_no_habilitado', error: 'Ese método ya no está disponible.' },
    MENSAJE_GENERICO,
  );
  assert.deepEqual(resultado, { tipo: 'metodo_no_habilitado', mensaje: 'Ese método ya no está disponible.' });
});

test('cuerpo nulo (JSON ilegible) → error genérico, mismo comportamiento que hoy', () => {
  const resultado = interpretarRespuestaOtroMetodo(null, MENSAJE_GENERICO);
  assert.deepEqual(resultado, { tipo: 'error', mensaje: MENSAJE_GENERICO });
});
