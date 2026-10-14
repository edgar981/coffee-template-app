import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obtenerSiteContentCompartido, refrescarSiteContentCompartido } from './site-content-compartido';

// EDITOR-CARGA-RAPIDA-1 — el invariante medido con el arnés (§ docstring del módulo): N llamadores
// concurrentes de `obtenerSiteContentCompartido` disparan UN SOLO fetch a `/api/site-content`, no N
// idénticos. `globalThis.fetch` se reemplaza por un contador — este módulo no sabe (ni le importa)
// si corre en el navegador o acá; sólo le importa cuántas veces LLAMÓ a `fetch`.
function instalarFetchFalso(respuestas: Array<{ ok: boolean; contenido?: Record<string, unknown>; sinPublicar?: Record<string, boolean> }>) {
  let llamadas = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    const r = respuestas[Math.min(llamadas, respuestas.length - 1)];
    llamadas += 1;
    return {
      ok: r.ok,
      json: async () => ({ contenido: r.contenido ?? {}, sinPublicar: r.sinPublicar ?? {} }),
    } as Response;
  }) as typeof fetch;
  return { contar: () => llamadas, restaurar: () => { globalThis.fetch = original; } };
}

// CADA TEST ARRANCA CON `refrescarSiteContentCompartido()` ANTES DE MEDIR — nunca asumiendo que la
// caché del módulo está vacía. `node --test` corre los bloques de UN archivo en orden dentro del
// mismo proceso (no por archivo separado garantizado), así que el segundo test puede heredar la
// caché YA RESUELTA que dejó el primero; `refrescarSiteContentCompartido` es la única de las dos
// funciones que SIEMPRE pega al fetch sin importar lo que haya cacheado — es la forma de poner el
// módulo en un estado CONOCIDO antes de medir el comportamiento que a cada test le toca probar.

test('obtenerSiteContentCompartido: N llamadores concurrentes comparten UN solo fetch', async () => {
  const falso = instalarFetchFalso([{ ok: true, contenido: { hero: { titulo: 'semilla' } }, sinPublicar: {} }]);
  try {
    // Deja la caché en un estado CONOCIDO (resuelta, de ESTE fetch falso) antes de medir lo que se
    // quiere probar — nunca asumiendo que empezaba vacía (§ arriba).
    await refrescarSiteContentCompartido();
    const antesDeLosSeis = falso.contar();

    const [a, b, c, d, e, f] = await Promise.all([
      obtenerSiteContentCompartido(),
      obtenerSiteContentCompartido(),
      obtenerSiteContentCompartido(),
      obtenerSiteContentCompartido(),
      obtenerSiteContentCompartido(),
      obtenerSiteContentCompartido(),
    ]);
    assert.equal(
      falso.contar() - antesDeLosSeis, 0,
      'con la caché ya resuelta, seis llamadores más no deben disparar un fetch nuevo',
    );
    for (const doc of [a, b, c, d, e, f]) assert.deepEqual(doc, { contenido: { hero: { titulo: 'semilla' } }, sinPublicar: {} });
  } finally {
    falso.restaurar();
  }
});

test('obtenerSiteContentCompartido: si NADIE pidió el dato todavía, N llamadores concurrentes disparan UN solo fetch (no N)', async () => {
  // Este caso SÓLO se puede afirmar con la caché vacía de verdad — por eso es el único test de este
  // archivo que no arranca con `refrescarSiteContentCompartido()`. Si `node --test` llegara a correr
  // los tests de este archivo en un proceso que ya tocó el módulo antes (orden no garantizado entre
  // archivos), la propiedad que importa —nunca más de un fetch por los seis— sigue siendo válida
  // igual: por eso la aserción es "a lo sumo 1", no "exactamente 1 partiendo de cero".
  const falso = instalarFetchFalso([{ ok: true, contenido: { hero: { titulo: 'primera-carga' } }, sinPublicar: {} }]);
  try {
    const antes = falso.contar();
    const resultados = await Promise.all([
      obtenerSiteContentCompartido(),
      obtenerSiteContentCompartido(),
      obtenerSiteContentCompartido(),
      obtenerSiteContentCompartido(),
      obtenerSiteContentCompartido(),
      obtenerSiteContentCompartido(),
    ]);
    assert.ok(
      falso.contar() - antes <= 1,
      'seis llamadores concurrentes nunca deben disparar más de UN fetch, lo haya o no en curso',
    );
    const primero = resultados[0];
    for (const doc of resultados) assert.deepEqual(doc, primero);
  } finally {
    falso.restaurar();
  }
});

test('refrescarSiteContentCompartido: SIEMPRE dispara un fetch nuevo, y deja ese resultado como la caché', async () => {
  const falso = instalarFetchFalso([
    { ok: true, contenido: { hero: { titulo: 'publicado' } }, sinPublicar: {} },
    { ok: true, contenido: { hero: { titulo: 'recién descartado' } }, sinPublicar: {} },
  ]);
  try {
    await refrescarSiteContentCompartido();
    const antes = falso.contar();

    const fresco = await refrescarSiteContentCompartido();
    assert.equal(falso.contar() - antes, 1, 'refrescar nunca reusa la caché vieja, aunque ya hubiera una resuelta');
    assert.deepEqual(fresco, { contenido: { hero: { titulo: 'recién descartado' } }, sinPublicar: {} });

    // Tras refrescar, un `obtener` posterior reusa ESTE resultado (el fresco), sin un tercer fetch.
    const reusado = await obtenerSiteContentCompartido();
    assert.equal(falso.contar() - antes, 1, 'tras refrescar, obtener vuelve a compartir sin pedir de nuevo');
    assert.deepEqual(reusado, fresco);
  } finally {
    falso.restaurar();
  }
});

test('un fetch fallido no deja la caché envenenada — el próximo llamador reintenta', async () => {
  const falso = instalarFetchFalso([
    { ok: false },
    { ok: true, contenido: { hero: { titulo: 'tras el reintento' } }, sinPublicar: {} },
  ]);
  try {
    const antes = falso.contar();
    await assert.rejects(() => refrescarSiteContentCompartido());
    assert.equal(falso.contar() - antes, 1);

    const tras = await obtenerSiteContentCompartido();
    assert.equal(falso.contar() - antes, 2, 'el rechazo anterior no debe quedar cacheado para siempre');
    assert.deepEqual(tras, { contenido: { hero: { titulo: 'tras el reintento' } }, sinPublicar: {} });
  } finally {
    falso.restaurar();
  }
});
