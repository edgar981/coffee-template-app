import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tituloAdmin, SUFIJO_PANEL } from './admin-titulo';
import { ADMIN_NAV } from '@/constants/admin-nav';

// EL INVARIANTE de esta tanda: la pestaña dice lo que dice el menú. No se afirma
// una lista de nueve strings —eso sería la segunda lista que el diseño evita—
// sino que la derivación no puede separarse de su fuente.

test('cada sección del menú tiene su título, y es IDÉNTICO a su label', () => {
  for (const item of ADMIN_NAV) {
    assert.equal(
      tituloAdmin(item.path), item.label,
      `la pestaña de ${item.path} debería decir lo mismo que el sidebar`,
    );
  }
});

test('renombrar una sección en el menú arrastra la pestaña — no hay copia que se quede atrás', () => {
  // Si alguien alguna vez re-teclea los títulos en vez de derivarlos, este test
  // sigue pasando pero el de arriba se rompe al primer renombre. Éste fija la
  // otra mitad: que la fuente sea EXACTAMENTE la del menú y no un subconjunto.
  const rutasDelNav = ADMIN_NAV.map(i => i.path);
  // NUEVE, y esta vez sin asterisco: se retiró la Clientes vieja y con ella la
  // ÚLTIMA convivencia viejo↔nuevo del panel. Una entrada por sección.
  //
  // El conteo es un tripwire a propósito: obliga a que agregar o quitar una
  // sección sea una decisión visible y no un efecto lateral. Ya cumplió tres
  // veces —al entrar la vertical de Clientes, al salir Órdenes y al salir esta—,
  // que es exactamente lo que se le pide.
  assert.equal(rutasDelNav.length, 9, 'el menú tiene nueve secciones, una por sección — sin convivencias');
  assert.ok(rutasDelNav.every(p => tituloAdmin(p) !== null));
});

test('las secciones fuera del menú traen el texto de su propia pantalla', () => {
  assert.equal(tituloAdmin('/admin/configuracion'), 'Configuración');
  assert.equal(tituloAdmin('/admin/perfil'), 'Mi perfil');
});

test('usuarios hereda Configuración: es subsección, y "Equipo" sería un tercer nombre', () => {
  assert.equal(tituloAdmin('/admin/configuracion/usuarios'), 'Configuración');
});

test('una ruta sin título declarado devuelve null, no un título fabricado', () => {
  // Hereda el `default` del layout del grupo. Fabricarlo desde el path daría
  // "Ordenes" sin tilde, que es peor que no decir nada.
  assert.equal(tituloAdmin('/admin/ruta-que-no-existe'), null);
  assert.equal(tituloAdmin('/admin'), null);
});

test('el detalle de un pedido NO tiene título propio: es un panel sobre la lista', () => {
  // `?pedido=CN-…` abre el panel dentro de /admin/pedidos; no es una ruta. Por eso
  // no se inventa un "CN-132453 · Panel Duna" — la pestaña sigue diciendo Pedidos,
  // que es donde el operador está.
  assert.equal(tituloAdmin('/admin/pedidos/CN-132453'), null);
});

test('el sufijo es uno solo', () => {
  assert.equal(SUFIJO_PANEL, 'Panel Duna');
});
