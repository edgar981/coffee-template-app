import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscarProductos } from './buscar';
import { categoriasDelCatalogo } from './categorias';

// El predicado mismo — MOVIDO tal cual desde NavSearch.tsx, no reescrito. Estas cuatro afirman que
// la extracción no cambió qué encuentra la búsqueda de hoy: coincide por nombre, categoría u
// origen, case-insensitive, por subcadena.

test('coincide por nombre, categoría u origen, case-insensitive', () => {
  const catalogo = [
    { nombre: 'Camiseta básica', categoria: 'Camisetas', origen: undefined },
    { nombre: 'Pantalón cargo', categoria: 'Pantalones', origen: undefined },
    { nombre: 'Correa de cuero', categoria: 'Accesorios', origen: 'Bucaramanga' },
  ];

  assert.deepEqual(
    buscarProductos(catalogo, 'camiseta').map((p) => p.nombre),
    ['Camiseta básica']
  );
  assert.deepEqual(
    buscarProductos(catalogo, 'PANTALONES').map((p) => p.nombre),
    ['Pantalón cargo']
  );
  assert.deepEqual(
    buscarProductos(catalogo, 'bucaramanga').map((p) => p.nombre),
    ['Correa de cuero']
  );
});

test('query vacía o sólo espacios → []', () => {
  const catalogo = [{ nombre: 'Camiseta básica', categoria: 'Camisetas', origen: undefined }];
  assert.deepEqual(buscarProductos(catalogo, ''), []);
  assert.deepEqual(buscarProductos(catalogo, '   '), []);
});

test('un producto sin origen no revienta la búsqueda (origen opcional)', () => {
  const catalogo = [{ nombre: 'Camiseta básica', categoria: 'Camisetas' }];
  assert.deepEqual(
    buscarProductos(catalogo, 'camiseta').map((p) => p.nombre),
    ['Camiseta básica']
  );
  assert.deepEqual(buscarProductos(catalogo, 'origen-inexistente'), []);
});

// LA PROPIEDAD (§ NAVSEARCH-CHIPS-CIERRE-1): toda sugerencia que el buscador OFRECE tiene que traer
// al menos un resultado. Se afirma con las DOS piezas reales —`categoriasDelCatalogo` genera las
// sugerencias (los chips del estado vacío) y `buscarProductos` es el predicado que las busca—, así
// que lo que esto ata es el ACOPLE entre las dos: si mañana alguien saca `categoria` del predicado,
// o cambia de qué campo salen los chips, los chips vuelven a morir y esto se cae NOMBRANDO cuál.
//
// El fixture es un catálogo NO-café a propósito (gemelo del de categorias.test.ts): prueba la
// propiedad para cualquier cliente, no que hoy funcione para Nayoli en particular.
test('toda categoría sugerida (derivada del catálogo) trae al menos un resultado', () => {
  const catalogo = [
    { nombre: 'Pantalón cargo', categoria: 'Pantalones', origen: undefined },
    { nombre: 'Camiseta básica', categoria: 'Camisetas', origen: undefined },
    { nombre: 'Camiseta oversize', categoria: 'Camisetas', origen: undefined },
    { nombre: 'Correa de cuero', categoria: 'Accesorios', origen: 'Bucaramanga' },
  ];

  const sugerencias = categoriasDelCatalogo(catalogo);
  assert.deepEqual(sugerencias, ['Accesorios', 'Camisetas', 'Pantalones']);

  // Afirmado por CONJUNTO, no por conteo: si una sugerencia se queda sin resultados, el fallo
  // nombra CUÁL — no dice "esperaba 0, recibí 1".
  const sinResultados = sugerencias.filter((cat) => buscarProductos(catalogo, cat).length === 0);
  assert.deepEqual(sinResultados, []);
});

// Historia: antes de NAVSEARCH-CHIPS-MUERTOS-1 las sugerencias eran CUATRO literales horneados
// ("Cold Brew", "Café Molido", "Geisha", "Suscripciones") que no derivaban de ningún catálogo. Con
// el mismo predicado de arriba, contra el catálogo REAL de Nayoli, tres de esos cuatro no traían
// ningún resultado — la propiedad de este archivo, aplicada retroactivamente, ya los delataba.
// Éste es el ÚNICO test del archivo que usa el catálogo de Nayoli: es histórico, no la propiedad
// general (§ el fixture de arriba es deliberadamente no-café).
test('los cuatro literales viejos contra el catálogo real de Nayoli: 3 de 4 no traían nada', () => {
  const catalogoNayoli = [
    { nombre: 'Café Nayoli — En grano 250 g', categoria: 'Café en Grano', origen: 'Supatá, Cundinamarca' },
    { nombre: 'Café Nayoli — Molido 250 g', categoria: 'Café Molido', origen: 'Supatá, Cundinamarca' },
    { nombre: 'Café Nayoli — En grano 500 g', categoria: 'Café en Grano', origen: 'Supatá, Cundinamarca' },
    { nombre: 'Café Nayoli — Molido 500 g', categoria: 'Café Molido', origen: 'Supatá, Cundinamarca' },
  ];
  const literalesViejos = ['Cold Brew', 'Café Molido', 'Geisha', 'Suscripciones'];

  const sinResultados = literalesViejos.filter(
    (term) => buscarProductos(catalogoNayoli, term).length === 0
  );
  assert.deepEqual(sinResultados, ['Cold Brew', 'Geisha', 'Suscripciones']);
});
