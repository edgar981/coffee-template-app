import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  destinoDesdeProductos, traducirQueryDeProductos, RUTA_PRODUCTOS,
} from '@/lib/redirect-productos';
import { destinoDesdeOrdenes } from '@/lib/redirect-ordenes';
import { destinoDesdeClientes } from '@/lib/redirect-clientes';

// La traducción es pura, así que se afirma entera sin montar un request. Lo que
// `proxy.ts` agrega es el 307 y el orden respecto de la sesión — plomería.

const destino = (url: string) => {
  const u = new URL(url, 'https://x');
  return destinoDesdeProductos(u.pathname, u.searchParams);
};

// ─── LA RUTA DE CONVIVENCIA ──────────────────────────────────────────────────

test('`-v2` va a la ruta que heredó la pantalla', () => {
  assert.equal(destino('/admin/productos-v2'), RUTA_PRODUCTOS);
});

test('`-v2` conserva carril, categoría y selección: el enlace sigue siendo exacto', () => {
  assert.equal(
    destino('/admin/productos-v2?f=reponer&cat=cafe_grano&producto=abc'),
    `${RUTA_PRODUCTOS}?f=reponer&cat=cafe_grano&producto=abc`,
  );
});

test('`-v2` con sólo uno de los tres params lo conserva', () => {
  assert.equal(destino('/admin/productos-v2?producto=abc'), `${RUTA_PRODUCTOS}?producto=abc`);
  assert.equal(destino('/admin/productos-v2?f=agotados'), `${RUTA_PRODUCTOS}?f=agotados`);
  assert.equal(destino('/admin/productos-v2?cat=cold_brew'), `${RUTA_PRODUCTOS}?cat=cold_brew`);
});

test('una subruta de `-v2` también cae a la ruta heredada', () => {
  // `/admin/productos-v2/lo-que-sea` nunca existió como página; se manda a la lista.
  assert.equal(destino('/admin/productos-v2/algo'), RUTA_PRODUCTOS);
});

test('`-v2` descarta lo que la pantalla nueva no habla', () => {
  // Nunca arrastrar basura de un enlace viejo: sólo f, cat y producto viajan.
  assert.equal(destino('/admin/productos-v2?utm_source=wa&producto=abc'), `${RUTA_PRODUCTOS}?producto=abc`);
});

// ─── LA TRAMPA DEL BUCLE ─────────────────────────────────────────────────────

test('LA LISTA PELADA NO SE REDIRIGE: es el destino, y redirigirla es un bucle', () => {
  // El middleware corre en CADA request, incluido el que él mismo provoca. Un
  // destino igual al origen no se ve como un bucle en la fuente: se ve como una
  // pestaña que nunca termina de cargar.
  assert.equal(destino('/admin/productos'), null);
});

test('`?producto=` en la ruta YA heredada NO se redirige — la nueva lo entiende', () => {
  // Es el punto clave del retiro: la ruta y el parámetro son los mismos; lo único
  // que cambia es el SIGNIFICADO (antes abría el modal de editar, ahora
  // selecciona). Eso lo resuelve la pantalla, no el redirect. Si esto devolviera
  // algo, sería un bucle sobre la propia ruta.
  assert.equal(destino('/admin/productos?producto=abc'), null);
  assert.equal(destino('/admin/productos?f=reponer'), null);
  assert.equal(destino('/admin/productos?cat=cafe_grano'), null);
});

// ─── QUÉ NO INTERCEPTA ───────────────────────────────────────────────────────

test('`null` para el resto del panel', () => {
  assert.equal(destino('/admin/pedidos?pedido=CN-1'), null);
  assert.equal(destino('/admin/inventario'), null);
  assert.equal(destino('/admin'), null);
});

test('no intercepta una ruta que sólo EMPIEZA parecido', () => {
  // El prefijo de `-v2` se corta en `/`. `-v3` no es `-v2`; `productosx` no es
  // productos.
  assert.equal(destino('/admin/productos-v3'), null);
  assert.equal(destino('/admin/productosx'), null);
});

// ─── LOS TRES REDIRECTS NO SE PISAN ──────────────────────────────────────────

test('ninguna ruta matchea DOS de los tres, así que el orden en proxy.ts da igual', () => {
  // Es lo que permite llamarlos uno tras otro sin pensar cuál va primero. Si
  // algún día una ruta cayera en dos, este test es el que lo dice. Se prueban las
  // rutas propias de los TRES retiros a la vez.
  const rutas = [
    '/admin/productos', '/admin/productos-v2', '/admin/productos-v2?producto=abc',
    '/admin/productos?producto=abc',
    '/admin/clientes', '/admin/clientes/abc', '/admin/clientes-v2',
    '/admin/ordenes', '/admin/ordenes?order=CN-1', '/admin/ordenes/algo',
    '/admin/pedidos', '/admin/dashboard',
  ];
  for (const r of rutas) {
    const u = new URL(r, 'https://x');
    const activos = [
      destinoDesdeProductos(u.pathname, u.searchParams),
      destinoDesdeClientes(u.pathname, u.searchParams),
      destinoDesdeOrdenes(u.pathname, u.searchParams),
    ].filter(d => d !== null);
    assert.ok(activos.length <= 1, `${r} cae en más de un redirect: ${activos.length}`);
  }
});

// ─── LA TRADUCCIÓN, SUELTA ───────────────────────────────────────────────────

test('un query sin nada de la pantalla nueva da cadena vacía, no basura', () => {
  assert.equal(traducirQueryDeProductos(new URLSearchParams('utm_source=wa')), '');
  assert.equal(traducirQueryDeProductos(new URLSearchParams('')), '');
});

test('los tres params conocidos sobreviven; el resto se descarta', () => {
  assert.equal(
    traducirQueryDeProductos(new URLSearchParams('f=reponer&cat=cold_brew&producto=x&otro=1')),
    'f=reponer&cat=cold_brew&producto=x',
  );
});
