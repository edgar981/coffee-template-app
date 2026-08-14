import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  destinoDesdeClientes, traducirQueryDeClientes, RUTA_CLIENTES,
} from '@/lib/redirect-clientes';
import { destinoDesdeOrdenes } from '@/lib/redirect-ordenes';

// La traducción es pura, así que se afirma entera sin montar un request. Lo que
// `proxy.ts` agrega es el 307 y el orden respecto de la sesión — plomería.

const destino = (url: string) => {
  const u = new URL(url, 'https://x');
  return destinoDesdeClientes(u.pathname, u.searchParams);
};

// ─── EL PERFIL, que es la población congelada en el localStorage del ⌘K ──────

test('el perfil se vuelve una selección del panel', () => {
  assert.equal(destino('/admin/clientes/abc123'), `${RUTA_CLIENTES}?cliente=abc123`);
});

test('un id con caracteres escapados llega decodificado al parámetro', () => {
  // El panel compara contra `Customer.id` crudo: sin decodificar, un id que
  // viniera escapado no empataría con ninguna fila y el sheet no abriría — que en
  // un teléfono se ve como un enlace que no hace nada.
  assert.equal(destino('/admin/clientes/a%20b'), `${RUTA_CLIENTES}?cliente=a+b`);
});

test('una subruta más profunda NO inventa un id: cae a la lista', () => {
  // `/admin/clientes/abc/def` nunca existió. Su "id" sería basura, y abrir el
  // panel en un cliente inexistente es peor que no abrirlo.
  assert.equal(destino('/admin/clientes/abc/def'), RUTA_CLIENTES);
});

test('la selección del PATH gana sobre un `?cliente=` del query', () => {
  // Quien escribió esa URL estaba pidiendo ESE perfil; el query es a lo sumo un
  // resto de otra navegación.
  assert.equal(destino('/admin/clientes/abc?cliente=zzz'), `${RUTA_CLIENTES}?cliente=abc`);
});

// ─── LA RUTA DE CONVIVENCIA ──────────────────────────────────────────────────

test('`-v2` va a la ruta que heredó la pantalla', () => {
  assert.equal(destino('/admin/clientes-v2'), RUTA_CLIENTES);
});

test('`-v2` conserva carril y selección: el enlace sigue siendo exacto', () => {
  assert.equal(
    destino('/admin/clientes-v2?f=atencion&cliente=abc'),
    `${RUTA_CLIENTES}?f=atencion&cliente=abc`,
  );
});

// ─── EL QUERY DE LA LISTA VIEJA ──────────────────────────────────────────────

test('`?recurrentes=1` se traduce al carril, que es el mismo predicado', () => {
  assert.equal(destino('/admin/clientes?recurrentes=1'), `${RUTA_CLIENTES}?f=recurrentes`);
});

test('`?recurrentes=0` NO se traduce — nunca significó "los no recurrentes"', () => {
  // La lista vieja sólo miraba `=== '1'`; cualquier otro valor era "sin filtro".
  // Traducirlo a un carril inventaría un conjunto que nunca existió.
  assert.equal(destino('/admin/clientes?recurrentes=0'), RUTA_CLIENTES);
});

// ─── LA TRAMPA DEL BUCLE ─────────────────────────────────────────────────────

test('LA LISTA PELADA NO SE REDIRIGE: es el destino, y redirigirla es un bucle', () => {
  // El middleware corre en CADA request, incluido el que él mismo provoca. Un
  // destino igual al origen no se ve como un bucle en la fuente: se ve como una
  // pestaña que nunca termina de cargar.
  assert.equal(destino('/admin/clientes'), null);
});

test('tampoco se redirige la lista que ya habla el vocabulario nuevo', () => {
  assert.equal(destino('/admin/clientes?f=recurrentes'), null);
  assert.equal(destino('/admin/clientes?cliente=abc'), null);
});

// ─── QUÉ NO INTERCEPTA ───────────────────────────────────────────────────────

test('`null` para el resto del panel', () => {
  assert.equal(destino('/admin/pedidos?pedido=CN-1'), null);
  assert.equal(destino('/admin/ordenes?order=CN-1'), null);
  assert.equal(destino('/admin'), null);
});

test('no intercepta una ruta que sólo EMPIEZA parecido', () => {
  // El prefijo se corta en `/`. `-v3` no es `-v2` ni es un perfil.
  assert.equal(destino('/admin/clientes-v3'), null);
  assert.equal(destino('/admin/clientesx'), null);
});

// ─── LOS DOS REDIRECTS NO SE PISAN ───────────────────────────────────────────

test('ninguna ruta matchea los DOS, así que el orden en proxy.ts da igual', () => {
  // Es lo que permite llamarlos uno tras otro sin pensar cuál va primero. Si
  // algún día una ruta cayera en los dos, este test es el que lo dice.
  const rutas = [
    '/admin/clientes', '/admin/clientes/abc', '/admin/clientes-v2',
    '/admin/clientes?recurrentes=1', '/admin/ordenes', '/admin/ordenes?order=CN-1',
    '/admin/ordenes/algo', '/admin/pedidos', '/admin/dashboard',
  ];
  for (const r of rutas) {
    const u = new URL(r, 'https://x');
    const a = destinoDesdeClientes(u.pathname, u.searchParams);
    const b = destinoDesdeOrdenes(u.pathname, u.searchParams);
    assert.ok(a === null || b === null, `${r} cae en los DOS redirects`);
  }
});

// ─── LA TRADUCCIÓN, SUELTA ───────────────────────────────────────────────────

test('un query sin nada traducible da cadena vacía, no basura', () => {
  assert.equal(traducirQueryDeClientes(new URLSearchParams('utm_source=wa')), '');
  assert.equal(traducirQueryDeClientes(new URLSearchParams('')), '');
});

test('un parámetro desconocido se DESCARTA en vez de viajar', () => {
  // Nunca 404 y nunca arrastrar: la pantalla nueva no tiene por qué recibir
  // claves que no entiende.
  assert.equal(destino('/admin/clientes/abc?orden=asc&utm=x'), `${RUTA_CLIENTES}?cliente=abc`);
});
