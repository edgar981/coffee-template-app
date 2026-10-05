import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_NAV, DESTINOS_FUERA_DEL_MENU } from '@/constants/admin-nav';
import { tituloAdmin } from '@/lib/admin-titulo';

// ─── LA ESTRUCTURA DEL MENÚ (§ PANEL-ESTRUCTURA-TIENDA-1, REDISENO.md § 3) ───────────────────────
//
// Guarda nueva que el spec pide: Tienda sale del rail (se entra por el nombre del negocio, no por
// una fila del menú); y lo que sale del rail —Tienda, Configuración, Mi perfil— NO puede perder su
// título de pestaña ni su lugar en el ⌘K. `lib/admin-titulo.test.ts` ya cubre el título uno por uno;
// este archivo afirma la ESTRUCTURA (qué está dentro/fuera de `ADMIN_NAV`, y que ninguna ruta del
// panel queda sin título), no vuelve a probar `tituloAdmin` campo por campo.

test('Tienda NO está en ADMIN_NAV — se entra desde el nombre del negocio, no desde una fila del menú', () => {
  assert.ok(
    !ADMIN_NAV.some((item) => item.path === '/admin/tienda'),
    'Tienda debería haber salido de ADMIN_NAV en PANEL-ESTRUCTURA-TIENDA-1',
  );
});

test('Tienda SÍ está en DESTINOS_FUERA_DEL_MENU — la fuente del ⌘K y del título de pestaña', () => {
  assert.ok(DESTINOS_FUERA_DEL_MENU.some((d) => d.path === '/admin/tienda'));
});

test('Configuración y Mi perfil siguen en DESTINOS_FUERA_DEL_MENU — no las desplazó Tienda al entrar', () => {
  const rutas = DESTINOS_FUERA_DEL_MENU.map((d) => d.path);
  assert.ok(rutas.includes('/admin/configuracion'));
  assert.ok(rutas.includes('/admin/perfil'));
});

test('ADMIN_NAV y DESTINOS_FUERA_DEL_MENU no se solapan — cada ruta vive en UN solo lugar', () => {
  const delMenu = new Set(ADMIN_NAV.map((i) => i.path));
  const fuera = DESTINOS_FUERA_DEL_MENU.map((d) => d.path);
  for (const path of fuera) {
    assert.ok(!delMenu.has(path), `${path} está en las dos listas a la vez`);
  }
});

test('ninguna ruta del panel (del rail o fuera de él) quedó sin título de pestaña', () => {
  const rutas = [...ADMIN_NAV.map((i) => i.path), ...DESTINOS_FUERA_DEL_MENU.map((d) => d.path)];
  for (const path of rutas) {
    assert.ok(tituloAdmin(path) !== null, `${path} no tiene título de pestaña`);
  }
});

test('toda entrada de DESTINOS_FUERA_DEL_MENU tiene ícono — el ⌘K y la hoja "Más" lo necesitan', () => {
  for (const d of DESTINOS_FUERA_DEL_MENU) {
    assert.ok(d.icon, `${d.path} no declara ícono`);
  }
});
