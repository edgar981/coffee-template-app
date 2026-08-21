import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinoDesdeEntregas, RUTA_ENTREGAS } from './redirect-entregas';
import { destinoDesdeOrdenes } from '@/lib/redirect-ordenes';
import { destinoDesdeClientes } from '@/lib/redirect-clientes';
import { destinoDesdeProductos } from '@/lib/redirect-productos';
import { destinoDesdeInventario } from '@/lib/redirect-inventario';

const d = (url: string) => {
  const u = new URL(url, 'https://x');
  return destinoDesdeEntregas(u.pathname, u.searchParams);
};
// La cadena COMPLETA de proxy.ts, en el mismo orden (con entregas al final).
const cadena = (url: string): string | null => {
  const u = new URL(url, 'https://x');
  return destinoDesdeOrdenes(u.pathname, u.searchParams)
    ?? destinoDesdeClientes(u.pathname, u.searchParams)
    ?? destinoDesdeProductos(u.pathname, u.searchParams)
    ?? destinoDesdeInventario(u.pathname, u.searchParams)
    ?? destinoDesdeEntregas(u.pathname, u.searchParams);
};

test('la ruta retirada, pelada, va al listado de Pedidos sin filtro', () => {
  assert.equal(d('/admin/entregas'), '/admin/pedidos');
});

test('cualquier subruta o query de la retirada → /admin/pedidos, NUNCA 404', () => {
  assert.equal(d('/admin/entregas/'), '/admin/pedidos');
  assert.equal(d('/admin/entregas/lo-que-sea'), '/admin/pedidos');
  // La vieja pantalla nunca emitió query, pero un enlace manual con basura tampoco 404ea.
  assert.equal(d('/admin/entregas?filtro=en_ruta'), '/admin/pedidos');
});

test('comparación POR SEGMENTO: una ruta que sólo EMPIEZA igual no se captura', () => {
  // El bug de caracteres-contra-segmentos que ya mordió en Clientes/Productos/rail.
  assert.equal(d('/admin/entregas-viejo'), null);
  assert.equal(d('/admin/entregasX'), null);
});

test('otras rutas del panel no se tocan', () => {
  assert.equal(d('/admin/pedidos'), null);
  assert.equal(d('/admin/inventario'), null);
  assert.equal(d('/admin'), null);
});

test('SIN BUCLE: el destino /admin/pedidos pasa en null por la cadena entera', () => {
  // La ruta retirada redirige una vez…
  assert.equal(cadena('/admin/entregas'), '/admin/pedidos');
  // …y el destino no lo re-captura NINGÚN redirect de la cadena → converge, no hay loop.
  assert.equal(cadena('/admin/pedidos'), null);
});

test('ningún otro retiro captura /admin/entregas (no hay doble captura)', () => {
  const u = new URL(RUTA_ENTREGAS, 'https://x');
  assert.equal(destinoDesdeOrdenes(u.pathname, u.searchParams), null);
  assert.equal(destinoDesdeClientes(u.pathname, u.searchParams), null);
  assert.equal(destinoDesdeProductos(u.pathname, u.searchParams), null);
  assert.equal(destinoDesdeInventario(u.pathname, u.searchParams), null);
  // Sólo el de entregas lo atiende, y su destino es el final.
  assert.equal(cadena(RUTA_ENTREGAS), '/admin/pedidos');
});
