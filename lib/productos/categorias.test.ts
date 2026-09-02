import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoriasDelCatalogo, catalogoTieneTostado } from './categorias';

// La taxonomía DERIVADA — el corazón de C3. Se afirma que un catálogo ARBITRARIO (no-café)
// produce sus categorías correctas, y que el de Nayoli (redefinido con labels limpios en el seed)
// da sus 2 categorías reales, no las 6 declaradas de antes.

test('catálogo NO-café arbitrario: sus categorías distintas, alfabéticas, sin duplicados', () => {
  const catalogo = [
    { categoria: 'Pantalones' },
    { categoria: 'Camisetas' },
    { categoria: 'Pantalones' }, // duplicada
    { categoria: 'Accesorios' },
  ];
  assert.deepEqual(categoriasDelCatalogo(catalogo), ['Accesorios', 'Camisetas', 'Pantalones']);
});

test('NAYOLI redefinido (labels limpios del seed): sus 2 categorías reales, no 6', () => {
  const catalogo = [
    { categoria: 'Café en Grano' },
    { categoria: 'Café Molido' },
    { categoria: 'Café en Grano' },
    { categoria: 'Café Molido' },
  ];
  // Dos pestañas, con label LIMPIO (el texto mismo), alfabéticas ("en Grano" < "Molido"). Las 4
  // "muertas" de antes (Cold Brew, Caja Regalo, …) no existen porque ningún producto las puebla.
  assert.deepEqual(categoriasDelCatalogo(catalogo), ['Café en Grano', 'Café Molido']);
});

test('categorías vacías / null / sólo espacios se ignoran (un producto sin categoría no es una pestaña)', () => {
  const catalogo = [
    { categoria: 'Miel' },
    { categoria: '' },
    { categoria: null },
    { categoria: '   ' },
    { categoria: undefined },
  ];
  assert.deepEqual(categoriasDelCatalogo(catalogo), ['Miel']);
});

test('catálogo vacío → cero categorías (sin pestañas, sin romper)', () => {
  assert.deepEqual(categoriasDelCatalogo([]), []);
});

test('catalogoTieneTostado: true si algún producto lo puebla, false si ninguno', () => {
  assert.equal(catalogoTieneTostado([{ tostado: 'medio' }, { tostado: null }]), true);
  assert.equal(catalogoTieneTostado([{ tostado: null }, { tostado: '' }, { tostado: '  ' }, {}]), false);
  assert.equal(catalogoTieneTostado([]), false);
  // Nayoli: sus 4 productos tienen tostado='medio' → la sección "Nivel de Tostado" se muestra.
  assert.equal(catalogoTieneTostado([{ tostado: 'medio' }, { tostado: 'medio' }]), true);
});
