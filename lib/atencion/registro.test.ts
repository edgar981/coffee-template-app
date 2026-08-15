import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SECCIONES_CON_ATENCION, atencionDeRuta, rutasConAtencion, rutasHuerfanas,
  type MapaAtencion,
} from './registro';
import { ADMIN_NAV } from '@/constants/admin-nav';

// ─── EL REGISTRO DEL PUNTO SOL ───────────────────────────────────────────────
//
// Lo que estos tests protegen NO es que el punto se pinte —eso se ve— sino los
// dos modos de falla MUDOS de este mecanismo: una ruta que no existe en el menú,
// y una sección registrada que el endpoint no cuenta. En los dos casos no se
// rompe nada: el punto simplemente no se enciende nunca, que es indistinguible de
// "no hay nada que atender".

test('el registro tiene DOS secciones — la generalización se hizo con dos casos, no con uno', () => {
  assert.equal(SECCIONES_CON_ATENCION.length, 2);
  assert.deepEqual(SECCIONES_CON_ATENCION.map(s => s.key), ['pedidos', 'productos']);
});

test('TODA ruta registrada existe en ADMIN_NAV — el modo de falla es mudo', () => {
  // Una ruta mal tecleada no rompe nada: el `find` no matchea, `atencionDeRuta`
  // devuelve false, y el punto no se enciende jamás. Nadie lo reporta porque
  // nada se ve roto. Este test es lo único que lo puede ver.
  assert.deepEqual(rutasHuerfanas(), []);
});

test('las claves son únicas — dos secciones con la misma clave se pisan en el mapa', () => {
  const claves = SECCIONES_CON_ATENCION.map(s => s.key);
  assert.equal(new Set(claves).size, claves.length);
});

test('atencionDeRuta lee POR RUTA, que es lo que el nav tiene en la mano', () => {
  const mapa: MapaAtencion = {
    pedidos:   { hay: true,  total: 3 },
    productos: { hay: false, total: 0 },
  };
  assert.equal(atencionDeRuta(mapa, '/admin/pedidos'), true);
  assert.equal(atencionDeRuta(mapa, '/admin/productos'), false);
});

test('una ruta SIN sección registrada no enciende nada — y no explota', () => {
  const mapa: MapaAtencion = { pedidos: { hay: true, total: 3 } };
  // Todas las demás entradas del menú pasan por acá en cada render del nav.
  for (const item of ADMIN_NAV) {
    if (rutasConAtencion().includes(item.path)) continue;
    assert.equal(atencionDeRuta(mapa, item.path), false, `${item.path} no debería encender`);
  }
});

test('una sección AUSENTE del mapa se lee como apagada, no como encendida', () => {
  // Pasa de verdad: el contador de una sección falla, o el cliente habla con un
  // servidor viejo que todavía no la reporta. Un punto encendido "por las dudas"
  // sería un aviso que el operador no puede resolver — no hay nada que atender.
  assert.equal(atencionDeRuta({}, '/admin/productos'), false);
  assert.equal(atencionDeRuta({ pedidos: { hay: true, total: 1 } }, '/admin/productos'), false);
});

test('`hay: true` con total 0 NO se cree — la verdad la dice `hay`, y viene del servidor', () => {
  // El servidor deriva `hay` de su propio conteo (`total > 0`) para que la
  // pregunta se responda en un solo lugar. El cliente NO la recalcula: si la
  // recalculara, habría dos opiniones sobre qué significa "hay algo".
  assert.equal(atencionDeRuta({ productos: { hay: true, total: 0 } }, '/admin/productos'), true);
});
