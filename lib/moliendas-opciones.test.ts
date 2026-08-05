import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decidirMolienda, moliendaAceptada, moliendasDisponibles, moliendaPorDefecto,
  agregableDirecto, normalizarOpciones, sanitizeOpciones, validarOpciones,
  opcionesVivas, revisarEdicion,
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

// ─── El EDITOR del admin: quién puede ESCRIBIR esta lista ────────────────────
// La matriz de arriba prueba que la línea que el cliente arma la acepta el
// servidor. Estos prueban lo de un paso antes: que el admin no pueda GUARDAR una
// lista con la que esa matriz ya no cierre. Mismo predicado en el modal y en el
// endpoint — el del modal es aviso temprano, el del endpoint es el que manda.

test('sanitizeOpciones recorta, coerciona `disponible` y descarta lo que no es objeto', () => {
  const sucio = [
    { nombre: '  Media  ', metodo: ' Filtro / Greca ', disponible: 'sí' },
    null, 'x', 7, undefined,
    { nombre: 'Gruesa' },                       // sin metodo ni disponible
  ];
  assert.deepEqual(sanitizeOpciones(sucio), [
    { nombre: 'Media',  metodo: 'Filtro / Greca', disponible: true  },
    { nombre: 'Gruesa', metodo: '',               disponible: false },
  ]);
});

test('sanitizeOpciones NO se traga una fila sin nombre — la deja para el validador', () => {
  // Descartarla en silencio haría que la fila desapareciera al guardar y el
  // operador la diera por creada. Se conserva justo para poder reportarla.
  const salida = sanitizeOpciones([{ nombre: '   ', metodo: 'V60', disponible: true }]);
  assert.equal(salida.length, 1);
  assert.equal(validarOpciones(salida)[0].codigo, 'nombre_vacio');
});

test('sanitizeOpciones sobre un valor que no es array da lista vacía', () => {
  for (const raw of [null, undefined, {}, 'x', 7]) {
    assert.deepEqual(sanitizeOpciones(raw), []);
  }
});

test('lista VACÍA es válida — es el producto que no pide molienda', () => {
  assert.deepEqual(validarOpciones([]), []);
  // Y sigue siendo el caso permisivo aguas abajo.
  assert.equal(agregableDirecto([]), true);
});

test('los datos reales del catálogo pasan la validación', () => {
  for (const opciones of [GRANO, MOLIDO, VARIAS]) {
    assert.deepEqual(validarOpciones(opciones), []);
  }
});

test('nombre vacío se reporta con su fila', () => {
  const opciones = [
    { nombre: 'Media', metodo: 'Filtro', disponible: true },
    { nombre: '  ',    metodo: 'V60',    disponible: false },
  ];
  const [problema] = validarOpciones(opciones);
  assert.equal(problema.codigo, 'nombre_vacio');
  assert.deepEqual(problema.indices, [1]);
});

test('duplicado: se compara sin mayúsculas ni espacios, y se señalan AMBAS filas', () => {
  // `moliendaAceptada` busca por nombre EXACTO, así que dos filas que el ojo lee
  // igual se comportarían distinto: una compraría y la otra daría 400.
  const opciones = [
    { nombre: 'Media',   metodo: 'Filtro', disponible: true },
    { nombre: ' media ', metodo: 'Greca',  disponible: false },
  ];
  const problema = validarOpciones(opciones).find(p => p.codigo === 'nombre_duplicado');
  assert.ok(problema);
  assert.deepEqual(problema.indices, [0, 1]);
});

test('LA TRAMPA: opciones declaradas con TODAS apagadas se rechaza al guardar', () => {
  // Es la disposición que deja un producto vivo en el catálogo e incompraable:
  // `decidirMolienda` lo manda al detalle y ahí `moliendaAceptada` rechaza todas.
  const agotado = MOLIDO.map(o => ({ ...o, disponible: false }));
  assert.equal(decidirMolienda(agotado).modo, 'agotada');   // el daño…
  const problema = validarOpciones(agotado).find(p => p.codigo === 'ninguna_disponible');
  assert.ok(problema);                                      // …y la puerta cerrada.
  assert.deepEqual(problema.indices, []);                   // es del conjunto, no de una fila
});

test('una sola opción apagada también es la trampa (no hace falta que sean siete)', () => {
  const opciones = [{ nombre: 'Media', metodo: 'Filtro', disponible: false }];
  assert.equal(validarOpciones(opciones).some(p => p.codigo === 'ninguna_disponible'), true);
});

test('los problemas se acumulan: una lista puede violar las tres reglas a la vez', () => {
  const opciones = [
    { nombre: 'Media', metodo: 'Filtro', disponible: false },
    { nombre: 'MEDIA', metodo: 'Greca',  disponible: false },
    { nombre: '',      metodo: '',       disponible: false },
  ];
  assert.deepEqual(
    validarOpciones(opciones).map(p => p.codigo),
    ['nombre_vacio', 'nombre_duplicado', 'ninguna_disponible'],
  );
});

// ─── Quitar es DESHACIBLE hasta guardar ──────────────────────────────────────
// La X del editor marca la fila, no la borra: se queda a la vista, tachada, con
// "Deshacer". Eso parte la lista en dos —lo que se PINTA y lo que se GUARDA— y
// todo lo de abajo existe para que las dos no se desincronicen.

test('las marcadas salen de lo que se guarda y las demás no se mueven', () => {
  const vivas = opcionesVivas(MOLIDO, new Set([1]));
  assert.deepEqual(vivas.map(o => o.nombre), ['Extra gruesa', 'Media', 'Fina']);
});

test('sin nada marcado, lo que se guarda es la lista entera', () => {
  assert.deepEqual(opcionesVivas(MOLIDO, new Set()), MOLIDO);
});

test('una fila marcada NO bloquea el guardado por estar sin nombre', () => {
  // El operador agrega una fila, se arrepiente y la quita sin haberla nombrado.
  // Si la validación siguiera mirándola, el modal quedaría trabado pidiendo que
  // llene algo que ya decidió no guardar.
  const opciones = [...GRANO, { nombre: '', metodo: '', disponible: true }];
  assert.equal(validarOpciones(opciones).length, 1);              // sin quitar: falla
  assert.deepEqual(revisarEdicion(opciones, new Set([1])).problemas, []);  // marcada: pasa
});

test('quitar la ÚNICA disponible SÍ bloquea — la trampa no se cuela por la puerta de atrás', () => {
  // La otra cara: lo que se marca no puede ignorarse a favor del operador. Si al
  // guardar no queda ninguna disponible, el producto queda incompraable igual.
  const { problemas } = revisarEdicion(MOLIDO, new Set([2]));   // 'Media' es la única disponible
  assert.deepEqual(problemas.map(p => p.codigo), ['ninguna_disponible']);
});

test('marcar TODAS deja lista vacía, que es válida — el producto deja de pedir molienda', () => {
  const { vivas, problemas } = revisarEdicion(MOLIDO, new Set([0, 1, 2, 3]));
  assert.deepEqual(vivas, []);
  assert.deepEqual(problemas, []);
  assert.equal(agregableDirecto(vivas), true);
});

test('EL OFF-BY-ONE: los índices de los problemas apuntan a la fila que se PINTA', () => {
  // `validarOpciones` numera sobre las vivas y el editor pinta la lista completa.
  // Sin remapear, el borde rojo cae en la fila de al lado — un defecto que no
  // rompe el guardado y por eso nadie ve hasta que confunde a un operador.
  const opciones = [
    { nombre: 'Gruesa', metodo: 'Prensa', disponible: true },   // 0 — marcada
    { nombre: 'Media',  metodo: 'Filtro', disponible: true },   // 1
    { nombre: '',       metodo: 'V60',    disponible: true },   // 2 — LA del problema
  ];
  const { problemas } = revisarEdicion(opciones, new Set([0]));
  const vacio = problemas.find(p => p.codigo === 'nombre_vacio');
  assert.ok(vacio);
  assert.deepEqual(vacio.indices, [2]);   // sin remapeo diría [1] y señalaría a 'Media'
});

test('el duplicado también se remapea, y señala las dos filas correctas', () => {
  const opciones = [
    { nombre: 'Fina',  metodo: 'Moka',   disponible: true },    // 0 — marcada
    { nombre: 'Media', metodo: 'Filtro', disponible: true },    // 1
    { nombre: 'media', metodo: 'Greca',  disponible: true },    // 2
  ];
  const { problemas } = revisarEdicion(opciones, new Set([0]));
  const dup = problemas.find(p => p.codigo === 'nombre_duplicado');
  assert.ok(dup);
  assert.deepEqual(dup.indices, [1, 2]);
});

test('una fila marcada no cuenta como duplicado de la que se conserva', () => {
  // Renombrar "por reemplazo": se quita la vieja y se agrega una con el mismo
  // nombre. Si la marcada siguiera contando, el editor lo llamaría duplicado y no
  // dejaría guardar algo perfectamente legal.
  const opciones = [
    { nombre: 'Media', metodo: 'Filtro viejo', disponible: true },   // 0 — marcada
    { nombre: 'Media', metodo: 'Filtro nuevo', disponible: true },   // 1
  ];
  assert.equal(validarOpciones(opciones).length, 1);                 // sin quitar: duplicado
  assert.deepEqual(revisarEdicion(opciones, new Set([0])).problemas, []);
});

test('todo lo que pasa el validador es guardable y comprable', () => {
  // El cierre del círculo: si `validarOpciones` deja pasar una lista, entonces
  // existe al menos una molienda que el servidor acepta en una línea de orden.
  for (const opciones of [GRANO, MOLIDO, VARIAS]) {
    assert.deepEqual(validarOpciones(opciones), []);
    const disponibles = moliendasDisponibles(opciones);
    assert.ok(disponibles.length > 0);
    for (const o of disponibles) assert.equal(moliendaAceptada(opciones, o.nombre), true);
  }
});
