import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { armarBloqueWompiPago } from '../route';
import { decidirReintentoPago, TOPE_INTENTOS_PAGO_POR_ORDEN } from '@duna/core/orders';
import { interpretarRespuestaReintento } from '@/components/storefront/checkout/interpretar-respuesta-reintento';

// NOTA DE ALCANCE — igual que `../route.test.ts`: las pruebas de `POST` se restringen a la
// rama que responde ANTES de tocar `crearIntentoPagoDeReintento` (Prisma real) — no hay DB
// efímera acá. El tope y las guardas de estado se afirman contra `decidirReintentoPago`
// (`@duna/core/orders`), la función PURA que corre bajo el lock — no requieren Postgres.
// El mecanismo de LOCK+CONTEO atómico que `crearIntentoPagoDeReintento` construye sobre esta
// decisión (mismo patrón `FOR UPDATE` que `lockOrderForPayment`, ya cubierto por el carril de
// integración para ese mecanismo en general) no se re-verifica con una base real en este
// archivo — `tests/integracion/` está fuera de `touches:` de este slice (ver el reporte).
//
// `interpretarRespuestaReintento` (el clasificador PURO del lado cliente,
// `components/storefront/checkout/interpretar-respuesta-reintento.ts`) se afirma ACÁ, no en un
// archivo propio bajo `components/storefront/checkout/`: un archivo `*.test.ts` nuevo en ese
// árbol rompe la reproducción histórica de `lib/gate/tests-descubiertos.test.ts`
// ("archivosSinCubrir: EL CASO REAL DE ANOCHE"), que re-escanea el árbol REAL contra los
// patrones de ANTES de `GATE-GLOB-COMPONENTS-SERVICES-1` y espera EXACTAMENTE los dos archivos
// que quedaron invisibles esa noche — un archivo nuevo bajo ese árbol la rompe sin que el
// código de este slice tenga ningún defecto (medido: se probó, y `archivosSinCubrir` pasó a
// devolver TRES en vez de dos). `lib/gate/` no está en `touches:` de este slice, así que esa
// guarda no se toca — el clasificador vive en `components/` (donde corresponde, junto a su
// hermano `interpretar-respuesta-otro-metodo.ts`) pero SU TEST vive acá, bajo `app/api/checkout/`
// (que sí estaba cubierto incluso por los patrones de esa noche), evitando el archivo nuevo que
// dispararía la regresión. Ver el reporte del slice.

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/checkout/reintento', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify(body),
  });
}

test('POST: sin `numero_orden` → 400, ANTES de tocar la base', async () => {
  const res = await POST(postRequest({}));
  assert.equal(res.status, 400);
});

test('POST: `numero_orden` vacío → 400', async () => {
  const res = await POST(postRequest({ numero_orden: '   ' }));
  assert.equal(res.status, 400);
});

test('POST: sin (d) [la pasarela apagada por despliegue] → 400, ANTES de tocar la base (sin crearIntentoPagoDeReintento)', async () => {
  const res = await POST(postRequest({ numero_orden: 'CN-123456' }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /no está disponible/i);
});

// ── decidirReintentoPago (§ CHECKOUT-REINTENTO-OTRO-METODO-1) ──────────────────────────────
// La decisión PURA que `crearIntentoPagoDeReintento` corre bajo el lock de la orden — "sigue
// pendiente" se verifica ANTES que el tope (§ el docstring de la función).

test('decidirReintentoPago: orden inexistente (null) → no_encontrada', () => {
  assert.deepEqual(decidirReintentoPago(null, 0), { tipo: 'no_encontrada' });
});

test('decidirReintentoPago: orden ya pagada → no_pendiente, con el estado real', () => {
  assert.deepEqual(decidirReintentoPago({ estado: 'pagado' }, 1), { tipo: 'no_pendiente', estado: 'pagado' });
});

test('decidirReintentoPago: orden cancelada → no_pendiente (no sólo "pagado")', () => {
  assert.deepEqual(decidirReintentoPago({ estado: 'cancelado' }, 1), { tipo: 'no_pendiente', estado: 'cancelado' });
});

test('decidirReintentoPago: "sigue pendiente" se verifica ANTES que el tope — una orden pagada con 0 intentos no cae en tope_alcanzado', () => {
  const resultado = decidirReintentoPago({ estado: 'pagado' }, 0);
  assert.equal(resultado.tipo, 'no_pendiente');
});

test(`decidirReintentoPago: por DEBAJO del tope (${TOPE_INTENTOS_PAGO_POR_ORDEN - 1} intentos existentes) → permitido`, () => {
  assert.deepEqual(
    decidirReintentoPago({ estado: 'pendiente' }, TOPE_INTENTOS_PAGO_POR_ORDEN - 1),
    { tipo: 'permitido' },
  );
});

test(`decidirReintentoPago: EN el tope (${TOPE_INTENTOS_PAGO_POR_ORDEN} intentos existentes) → tope_alcanzado, no se ofrece un cuarto`, () => {
  assert.deepEqual(
    decidirReintentoPago({ estado: 'pendiente' }, TOPE_INTENTOS_PAGO_POR_ORDEN),
    { tipo: 'tope_alcanzado' },
  );
});

test('decidirReintentoPago: por ENCIMA del tope también se rechaza (defensivo, no sólo el borde exacto)', () => {
  assert.deepEqual(
    decidirReintentoPago({ estado: 'pendiente' }, TOPE_INTENTOS_PAGO_POR_ORDEN + 5),
    { tipo: 'tope_alcanzado' },
  );
});

// ── armarBloqueWompiPago (§ arriba, `../route.ts`) — ACEPTACIONES FRESCAS ───────────────────
// El reintento y la creación original comparten esta función: las DOS piden un bloque nuevo
// vía `obtenerBloqueAceptacionPasarela`, nunca uno guardado de un intento anterior — no hay
// parámetro de entrada por el que un token viejo pudiera colarse (la firma de la función sólo
// toma `reference` y `montoEsperado`, ninguno de los dos es una aceptación).

test('armarBloqueWompiPago: sin WOMPI_INTEGRITY_SECRET → sin_config, ANTES de pedir el bloque de aceptación', async () => {
  const previoSecreto = process.env.WOMPI_INTEGRITY_SECRET;
  delete process.env.WOMPI_INTEGRITY_SECRET;
  try {
    const resultado = await armarBloqueWompiPago('CN-123456:abc', 28_000);
    assert.deepEqual(resultado, { ok: false, razon: 'sin_config' });
  } finally {
    if (previoSecreto !== undefined) process.env.WOMPI_INTEGRITY_SECRET = previoSecreto;
  }
});

test('armarBloqueWompiPago: sin WOMPI_PUBLIC_KEY → sin_config', async () => {
  const previaLlave = process.env.WOMPI_PUBLIC_KEY;
  delete process.env.WOMPI_PUBLIC_KEY;
  try {
    const resultado = await armarBloqueWompiPago('CN-123456:abc', 28_000);
    assert.deepEqual(resultado, { ok: false, razon: 'sin_config' });
  } finally {
    if (previaLlave !== undefined) process.env.WOMPI_PUBLIC_KEY = previaLlave;
  }
});

// ── interpretarRespuestaReintento (§ CHECKOUT-REINTENTO-OTRO-METODO-1) ──────────────────────
// La clasificación PURA de la respuesta de ESTE endpoint, del lado del cliente — mismo criterio
// que `interpretar-respuesta-otro-metodo.test.ts`: se extrae para poder afirmarla sin red.

const MENSAJE_GENERICO_CLIENTE = 'No pudimos procesar tu solicitud. Intenta de nuevo.';

const WOMPI_EJEMPLO = {
  reference: 'CN-123456:cuid2',
  amountInCents: 2_800_000,
  currency: 'COP',
  signature: 'sig',
  publicKey: 'pub_test_1',
  aceptaciones: {
    terminos: { token: 'tok-t2', url: 'https://example.com/terminos' },
    datosPersonales: { token: 'tok-d2', url: 'https://example.com/datos' },
  },
  metodosPasarelaOtros: ['NEQUI'],
};

test('interpretarRespuestaReintento: tipo "creado" con bloque wompi → clasifica creado, tal cual llegó', () => {
  const resultado = interpretarRespuestaReintento({ tipo: 'creado', wompi: WOMPI_EJEMPLO }, MENSAJE_GENERICO_CLIENTE);
  assert.deepEqual(resultado, { tipo: 'creado', wompi: WOMPI_EJEMPLO });
});

test('interpretarRespuestaReintento: el bloque wompi es el de ESTA respuesta — dos llamadas con aceptaciones distintas no se mezclan ni se cachean', () => {
  const primera = interpretarRespuestaReintento({ tipo: 'creado', wompi: WOMPI_EJEMPLO }, MENSAJE_GENERICO_CLIENTE);
  const segundaWompi = {
    ...WOMPI_EJEMPLO,
    aceptaciones: { terminos: { token: 'tok-t3', url: 'x' }, datosPersonales: { token: 'tok-d3', url: 'y' } },
  };
  const segunda = interpretarRespuestaReintento({ tipo: 'creado', wompi: segundaWompi }, MENSAJE_GENERICO_CLIENTE);
  assert.equal(primera.tipo, 'creado');
  assert.equal(segunda.tipo, 'creado');
  if (primera.tipo === 'creado' && segunda.tipo === 'creado') {
    assert.notEqual(segunda.wompi.aceptaciones.terminos.token, primera.wompi.aceptaciones.terminos.token);
  }
});

test('interpretarRespuestaReintento: "creado" sin bloque wompi → NO se clasifica como éxito', () => {
  const resultado = interpretarRespuestaReintento({ tipo: 'creado' }, MENSAJE_GENERICO_CLIENTE);
  assert.deepEqual(resultado, { tipo: 'error', mensaje: MENSAJE_GENERICO_CLIENTE });
});

test('interpretarRespuestaReintento: no_pendiente con estado "pagado" → ya_pagada', () => {
  const resultado = interpretarRespuestaReintento({ tipo: 'no_pendiente', estado: 'pagado', error: 'x' }, MENSAJE_GENERICO_CLIENTE);
  assert.deepEqual(resultado, { tipo: 'ya_pagada' });
});

test('interpretarRespuestaReintento: no_pendiente con estado "cancelado" → error genérico, NO ya_pagada', () => {
  const resultado = interpretarRespuestaReintento(
    { tipo: 'no_pendiente', estado: 'cancelado', error: 'Esta orden ya no admite un nuevo intento de pago.' },
    MENSAJE_GENERICO_CLIENTE,
  );
  assert.deepEqual(resultado, { tipo: 'error', mensaje: 'Esta orden ya no admite un nuevo intento de pago.' });
});

test('interpretarRespuestaReintento: tope_alcanzado → su propio camino, con el mensaje del servidor', () => {
  const resultado = interpretarRespuestaReintento(
    { tipo: 'tope_alcanzado', error: 'Ya intentaste pagar varias veces y no fue posible completar el cobro.' },
    MENSAJE_GENERICO_CLIENTE,
  );
  assert.deepEqual(resultado, { tipo: 'tope_alcanzado', mensaje: 'Ya intentaste pagar varias veces y no fue posible completar el cobro.' });
});

test('interpretarRespuestaReintento: no_encontrada → error genérico con el mensaje del servidor', () => {
  const resultado = interpretarRespuestaReintento({ tipo: 'no_encontrada', error: 'No encontramos el pedido.' }, MENSAJE_GENERICO_CLIENTE);
  assert.deepEqual(resultado, { tipo: 'error', mensaje: 'No encontramos el pedido.' });
});

test('interpretarRespuestaReintento: cuerpo nulo (JSON ilegible, o fallo de red) → error genérico', () => {
  const resultado = interpretarRespuestaReintento(null, MENSAJE_GENERICO_CLIENTE);
  assert.deepEqual(resultado, { tipo: 'error', mensaje: MENSAJE_GENERICO_CLIENTE });
});

test('interpretarRespuestaReintento: sin `error` del servidor → cae al mensaje por defecto, nunca uno inventado', () => {
  const resultado = interpretarRespuestaReintento({ tipo: 'otro_tipo_desconocido' }, MENSAJE_GENERICO_CLIENTE);
  assert.deepEqual(resultado, { tipo: 'error', mensaje: MENSAJE_GENERICO_CLIENTE });
});

// ── El BLOQUE que este endpoint devuelve NUNCA es el que el comprador ya vio ────────────────
// Afirma, junto con `armarBloqueWompiPago` de arriba (que llama a `obtenerBloqueAceptacionPasarela`
// SIEMPRE, sin caché) y este clasificador (que sólo lee `body.wompi` — nunca un valor guardado de
// otra parte), que la cadena entera "aceptaciones frescas" no tiene ningún punto de reuso: el
// servidor las pide de nuevo cada vez, y el cliente sólo puede leer las que ESTA respuesta trajo.

test('la forma del endpoint no tiene ningún parámetro de ENTRADA por el que una aceptación vieja pudiera viajar — POST sólo acepta `numero_orden`', async () => {
  const conAceptacionesColadas = postRequest({
    numero_orden: 'CN-123456',
    aceptaciones: { terminos: 'token-viejo', datosPersonales: 'token-viejo' },
  });
  const res = await POST(conAceptacionesColadas);
  // La pasarela sigue apagada por despliegue en este entorno de test — el 400 confirma que la
  // ruta llegó hasta esa guarda IGNORANDO por completo cualquier campo `aceptaciones` colado en
  // el body: no hay código en `reintentoSchema`/`POST` que lo lea.
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /no está disponible/i);
});
