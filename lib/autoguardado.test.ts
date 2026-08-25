import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAutoguardado } from './autoguardado';

// El coordinador de autoguardado, con RELOJES FALSOS (node:test mock.timers). Afirma la lógica
// delicada: debounce (ráfaga = un guardado), encolado (editar en vuelo no se pierde), reintento.

// Vacía la cola de microtareas (las continuaciones de `guardar().then(...)`), que los relojes
// falsos NO controlan.
const micro = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

test('RÁFAGA: 20 teclas en la ventana producen UN guardado, no 20 (la razón del debounce)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const guardados: string[] = [];
  const co = crearAutoguardado<string>({ guardar: async (d) => { guardados.push(d); }, retrasoMs: 1000 });

  // 20 teclas a 100ms (2s total); cada una REINICIA el debounce, así que ninguna dispara aún.
  for (let i = 0; i < 20; i++) { co.marcarSucio(`v${i}`); t.mock.timers.tick(100); }
  assert.equal(guardados.length, 0);          // nada guardado durante la ráfaga
  t.mock.timers.tick(1000);                    // 1s tras la última tecla
  await micro();
  assert.deepEqual(guardados, ['v19']);        // UN guardado, con el último valor
  assert.equal(co.estado, 'guardado');
});

test('ENCOLADO: editar durante un guardado EN VUELO no pierde ese cambio', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const guardados: string[] = [];
  let resolver!: () => void;
  // `guardar` queda EN VUELO hasta que resolvamos a mano.
  const co = crearAutoguardado<string>({
    guardar: (d) => { guardados.push(d); return new Promise<void>((r) => { resolver = r; }); },
    retrasoMs: 1000,
  });

  co.marcarSucio('A');
  t.mock.timers.tick(1000);
  await micro();
  assert.deepEqual(guardados, ['A']);          // A está guardándose (en vuelo)

  co.marcarSucio('B');                          // se EDITA durante el guardado de A
  await micro();
  assert.deepEqual(guardados, ['A']);           // B no dispara otro guardado todavía (uno en vuelo)

  resolver();                                   // termina el guardado de A → arranca el de B (encolado)
  await micro();
  assert.deepEqual(guardados, ['A', 'B']);      // B se guardó al terminar A (no se perdió)
  assert.equal(co.estado, 'guardando');         // B quedó EN VUELO

  resolver();                                   // `resolver` ahora es el de B → termina
  await micro();
  assert.equal(co.estado, 'guardado');
});

test('FALLO → error, y reintenta solo cuando la red vuelve', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const guardados: string[] = [];
  let fallar = true;
  const co = crearAutoguardado<string>({
    guardar: async (d) => { guardados.push(d); if (fallar) throw new Error('red'); },
    retrasoMs: 1000, reintentoMs: 5000,
  });

  co.marcarSucio('A');
  t.mock.timers.tick(1000);
  await micro();
  assert.equal(co.estado, 'error');             // falló
  assert.deepEqual(guardados, ['A']);

  fallar = false;                               // la red vuelve
  t.mock.timers.tick(5000);                     // el reintento programado
  await micro();
  assert.equal(co.estado, 'guardado');          // reintentó y logró
  assert.deepEqual(guardados, ['A', 'A']);      // con el mismo dato
});

test('FLUSH: guarda YA lo pendiente sin esperar el debounce (blur / unmount)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const guardados: string[] = [];
  const co = crearAutoguardado<string>({ guardar: async (d) => { guardados.push(d); }, retrasoMs: 1000 });

  co.marcarSucio('A');
  co.flush();                                   // sin avanzar el reloj
  await micro();
  assert.deepEqual(guardados, ['A']);
  assert.equal(co.estado, 'guardado');
});

test('editar tras un ERROR vuelve a "guardando" (optimista) y reintenta con el debounce', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const guardados: string[] = [];
  let fallar = true;
  const co = crearAutoguardado<string>({
    guardar: async (d) => { guardados.push(d); if (fallar) throw new Error('red'); },
    retrasoMs: 1000, reintentoMs: 999999, // el reintento por backoff no llega en este test
  });

  co.marcarSucio('A');
  t.mock.timers.tick(1000); await micro();
  assert.equal(co.estado, 'error');

  fallar = false;
  co.marcarSucio('B');                          // el dueño sigue editando tras el fallo
  assert.equal(co.estado, 'guardando');         // optimista, no se queda en error
  t.mock.timers.tick(1000); await micro();
  assert.equal(co.estado, 'guardado');
  assert.deepEqual(guardados, ['A', 'B']);      // B se guardó (no se quedó en A)
});
