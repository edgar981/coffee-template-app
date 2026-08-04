import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decidirMolienda, moliendaAceptada, moliendasDisponibles, moliendaPorDefecto,
  agregableDirecto, normalizarOpciones,
} from './moliendas-opciones';

// Estos tests existen por un bug de go-live, no por cobertura: había DOS formas de
// construir una línea de carrito. El detalle mandaba la molienda preseleccionada;
// la card del catálogo no mandaba ninguna. Como los cuatro productos declaran
// opciones, todo lo agregado desde la vitrina moría con 400 "Molienda no
// disponible" en el último paso del pago.
//
// Por eso la matriz de abajo es CLIENTE × SERVIDOR sobre la misma cardinalidad: lo
// que se prueba no es cada función suelta, sino que la línea que el cliente decide
// construir sea siempre una que el servidor acepte. El próximo punto de agregar
// que aparezca choca contra esto antes que contra un cliente real.

// Los datos reales del catálogo de Nayoli (verificados en producción el
// 2026-08-04): el grano declara UNA opción disponible; el molido declara siete con
// una sola disponible. Ninguno declara cero — la rama permisiva del servidor no la
// alcanza ningún producto vivo, que es justo lo que hizo el bug total.
const GRANO = [{ nombre: 'Grano entero', metodo: 'Muele en casa a tu gusto', disponible: true }];
const MOLIDO = [
  { nombre: 'Extra gruesa',  metodo: 'Cold brew',           disponible: false },
  { nombre: 'Gruesa',        metodo: 'Prensa francesa',     disponible: false },
  { nombre: 'Media',         metodo: 'Filtro / Greca',      disponible: true  },
  { nombre: 'Fina',          metodo: 'Moka / Espresso',     disponible: false },
];
/** El caso latente: el cliente habilita varias moliendas. Hoy no existe en la DB. */
const VARIAS = [
  { nombre: 'Media',  metodo: 'Filtro / Greca',  disponible: true },
  { nombre: 'Gruesa', metodo: 'Prensa francesa', disponible: true },
];
const SIN_OPCIONES: unknown[] = [];

// ─── LA matriz: lo que el cliente construye, ¿lo acepta el servidor? ──────────

test('cardinalidad 1: la card agrega directo y el servidor acepta esa línea', () => {
  for (const opciones of [GRANO, MOLIDO]) {
    const d = decidirMolienda(opciones);
    assert.equal(d.modo, 'automatica');
    // Lo que la card manda…
    const molienda = moliendaPorDefecto(opciones);
    // …tiene que ser exactamente lo que el servidor acepta.
    assert.equal(moliendaAceptada(opciones, molienda), true);
  }
});

test('cardinalidad N: la card NO agrega — manda a elegir al detalle', () => {
  assert.equal(decidirMolienda(VARIAS).modo, 'eleccion');
  assert.equal(agregableDirecto(VARIAS), false);
});

test('EL BUG: línea sin molienda contra un producto que declara opciones → rechazada', () => {
  // La regresión concreta. Si alguien vuelve a llamar `addItem(product, 1)` sin
  // opciones, esto es lo que le pasa a esa línea en el checkout.
  for (const opciones of [GRANO, MOLIDO, VARIAS]) {
    assert.equal(moliendaAceptada(opciones, null), false);
    assert.equal(moliendaAceptada(opciones, undefined), false);
    assert.equal(moliendaAceptada(opciones, ''), false);
  }
});

test('sin opciones declaradas, ambas formas de línea son legales', () => {
  assert.equal(decidirMolienda(SIN_OPCIONES).modo, 'ninguna');
  assert.equal(agregableDirecto(SIN_OPCIONES), true);
  assert.equal(moliendaPorDefecto(SIN_OPCIONES), null);
  assert.equal(moliendaAceptada(SIN_OPCIONES, null), true);
  assert.equal(moliendaAceptada(SIN_OPCIONES, 'Lo que sea'), true);
});

// ─── La regla del servidor, sin relajar ──────────────────────────────────────

test('una molienda que existe pero NO está disponible se rechaza', () => {
  assert.equal(moliendaAceptada(MOLIDO, 'Extra gruesa'), false);
  assert.equal(moliendaAceptada(MOLIDO, 'Media'), true);
});

test('una molienda inventada se rechaza', () => {
  assert.equal(moliendaAceptada(GRANO, 'Turca'), false);
});

test('`null` NO significa "Grano entero" — el grano tiene su opción con nombre', () => {
  // La confusión que originó el reporte. Si algún día se decide que null es grano
  // entero, este test se cae y obliga a cambiarlo a conciencia, no de pasada.
  assert.equal(moliendaAceptada(GRANO, null), false);
  assert.equal(moliendaAceptada(GRANO, 'Grano entero'), true);
});

// ─── Datos degradados: fallar hacia el lado que no bloquea una venta ─────────

test('un JSON que no es array se trata como "sin opciones", no como error', () => {
  for (const raw of [null, undefined, {}, 'x', 7]) {
    assert.deepEqual(normalizarOpciones(raw), []);
    assert.equal(moliendaAceptada(raw, null), true);
    assert.equal(decidirMolienda(raw).modo, 'ninguna');
  }
});

test('las entradas nulas dentro del array se descartan sin reventar', () => {
  const sucio = [null, ...GRANO, undefined];
  assert.equal(moliendasDisponibles(sucio).length, 1);
  assert.equal(decidirMolienda(sucio).modo, 'automatica');
  assert.equal(moliendaAceptada(sucio, 'Grano entero'), true);
});

test('declara opciones pero ninguna disponible: ni se agrega ni se acepta', () => {
  const agotado = MOLIDO.map(o => ({ ...o, disponible: false }));
  assert.equal(decidirMolienda(agotado).modo, 'agotada');
  assert.equal(agregableDirecto(agotado), false);
  assert.equal(moliendaAceptada(agotado, 'Media'), false);
});
