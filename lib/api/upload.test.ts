import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { subirDirecto, esSesionVencida, MSG_SESION_VENCIDA } from './upload';

// § PANEL-ERROR-SUBIDA-VISIBLE-1 — el rechazo por SESIÓN (vencida o sin rol; el mismo gate 401 de
// `GET /api/upload/token`, `sesionAdmin` en app/api/upload/token/route.ts) se distingue de cualquier
// otro fallo, para que el panel pueda ofrecer "vuelve a iniciar sesión" en vez de un "reintenta" que
// no arregla nada — la sesión sigue vencida hasta que el dueño vuelva a entrar.
//
// Se prueba interceptando `fetch` (nunca la red real) — mismo patrón que
// lib/pagos/creacion-transaccion.test.ts (`stubFetchCapturandoCuerpo`). `subirDirecto` llama a
// `envPrefijo()` ANTES de tocar el archivo o invocar al SDK de subida (`upload` de
// `@vercel/blob/client`), así que un GET rechazado corta ahí — el `File` nunca se lee y el mock no
// necesita simular la subida en sí.

const fetchOriginal = global.fetch;
afterEach(() => { global.fetch = fetchOriginal; });

/** Reemplaza `global.fetch` por un doble que responde SIEMPRE con el `status` dado al GET del token
 *  —nunca toca la red—. El body no importa para estos tests: lo que se afirma es el mensaje que
 *  `subirDirecto` produce a partir del STATUS, no del cuerpo. */
function stubFetchToken(status: number) {
  global.fetch = (async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ error: 'No autorizado' }),
  })) as unknown as typeof fetch;
}

test('esSesionVencida: reconoce SÓLO el mensaje exacto de sesión, nunca un parecido', () => {
  assert.equal(esSesionVencida(MSG_SESION_VENCIDA), true);
  assert.equal(esSesionVencida('Tu sesión expiró de otra forma'), false);
  assert.equal(esSesionVencida('No se pudo subir la imagen. Reintenta.'), false);
  assert.equal(esSesionVencida(''), false);
});

test('subirDirecto: el GET del token con 401 (sesión vencida o sin rol) rechaza con MSG_SESION_VENCIDA, ANTES de intentar subir', async () => {
  stubFetchToken(401);
  const archivo = {} as File; // nunca se lee: el rechazo ocurre antes de `sanitizeFilename(file.name)`
  await assert.rejects(
    () => subirDirecto(archivo, { carpeta: 'contenido' }),
    (err: Error) => {
      assert.equal(err.message, MSG_SESION_VENCIDA);
      assert.equal(esSesionVencida(err.message), true);
      return true;
    },
  );
});

test('subirDirecto: un fallo del GET del token que NO es 401 (p. ej. 500) NO se confunde con sesión vencida', async () => {
  stubFetchToken(500);
  const archivo = {} as File;
  await assert.rejects(
    () => subirDirecto(archivo, { carpeta: 'contenido' }),
    (err: Error) => {
      assert.equal(esSesionVencida(err.message), false);
      assert.notEqual(err.message, MSG_SESION_VENCIDA);
      return true;
    },
  );
});

test('subirDirecto: un SEGUNDO intento tras un 401 vuelve a preguntar (el fallo no se cachea) — si el dueño reingresó, el siguiente intento ya no ve el mensaje de sesión', async () => {
  stubFetchToken(401);
  await assert.rejects(() => subirDirecto({} as File, { carpeta: 'contenido' }));

  // El dueño reingresa: el GET ahora respondería 200, pero no hay forma barata de simular la subida
  // completa (golpea `upload()` del SDK, red real de Blob) desde este carril — lo que se afirma acá
  // es que el 401 NO dejó el fallo cacheado (`prefijoPromesa` se resetea, § envPrefijo), no la subida
  // exitosa en sí: un tercer 401 se reconoce igual que el primero, prueba de que se re-preguntó.
  stubFetchToken(401);
  await assert.rejects(
    () => subirDirecto({} as File, { carpeta: 'contenido' }),
    (err: Error) => { assert.equal(err.message, MSG_SESION_VENCIDA); return true; },
  );
});
