import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  destinoDesdeInventario, traducirQueryDeAuditoria,
  RUTA_INVENTARIO,
} from '@/lib/redirect-inventario';
import { destinoDesdeOrdenes } from '@/lib/redirect-ordenes';
import { destinoDesdeClientes } from '@/lib/redirect-clientes';
import { destinoDesdeProductos } from '@/lib/redirect-productos';
import { RUTA_REPONER } from '@/lib/productos/filtros';

// La traducción es pura; se afirma entera sin montar un request. `proxy.ts` sólo
// agrega el 307 y el orden respecto de la sesión.
const destino = (url: string) => {
  const u = new URL(url, 'https://x');
  return destinoDesdeInventario(u.pathname, u.searchParams);
};

// LA CADENA EXACTA de proxy.ts, en su orden, para afirmar el DESTINO FINAL —no
// sólo que los matchers no se pisen—.
const cadena = (url: string): string | null => {
  const u = new URL(url, 'https://x');
  return destinoDesdeOrdenes(u.pathname, u.searchParams)
    ?? destinoDesdeClientes(u.pathname, u.searchParams)
    ?? destinoDesdeProductos(u.pathname, u.searchParams)
    ?? destinoDesdeInventario(u.pathname, u.searchParams);
};

// ─── LA RUTA DE CONVIVENCIA ──────────────────────────────────────────────────

test('`-v2` va a la ruta que heredó la pantalla', () => {
  assert.equal(destino('/admin/inventario-v2'), RUTA_INVENTARIO);
});

test('`-v2` conserva el vocabulario de la auditoría (producto/tipo/desde/hasta)', () => {
  assert.equal(
    destino('/admin/inventario-v2?producto=abc&tipo=venta&desde=2026-03-01&hasta=2026-03-31'),
    `${RUTA_INVENTARIO}?producto=abc&tipo=venta&desde=2026-03-01&hasta=2026-03-31`,
  );
});

test('`-v2` con sólo uno de los params lo conserva', () => {
  assert.equal(destino('/admin/inventario-v2?tipo=ajuste'), `${RUTA_INVENTARIO}?tipo=ajuste`);
});

test('una subruta de `-v2` también cae a la ruta heredada', () => {
  assert.equal(destino('/admin/inventario-v2/algo'), RUTA_INVENTARIO);
});

test('`-v2` descarta lo que la auditoría no habla', () => {
  assert.equal(destino('/admin/inventario-v2?utm=wa&tipo=salida'), `${RUTA_INVENTARIO}?tipo=salida`);
});

// ─── EL PARAM LEGACY DE STOCK BAJO → PRODUCTOS (sale de la sección) ───────────

test('`?stock=bajo-minimo` no cae a la auditoría: va a la cola de Productos', () => {
  assert.equal(destino('/admin/inventario?stock=bajo-minimo'), RUTA_REPONER);
});

test('sólo el VALOR exacto se redirige; otro `stock` pasa derecho', () => {
  assert.equal(destino('/admin/inventario?stock=otra'), null);
  assert.equal(destino('/admin/inventario?stock='), null);
});

// ─── LA TRAMPA DEL BUCLE ─────────────────────────────────────────────────────

test('la auditoría PELADA no se redirige: es el destino, y redirigirla es un bucle', () => {
  assert.equal(destino('/admin/inventario'), null);
});

test('los params de auditoría en la ruta YA heredada pasan derecho', () => {
  assert.equal(destino('/admin/inventario?producto=abc'), null);
  assert.equal(destino('/admin/inventario?tipo=venta&desde=2026-01-01'), null);
});

// ─── EL SEGMENTO, NO EL PREFIJO ──────────────────────────────────────────────

test('no intercepta una ruta que sólo EMPIEZA parecido', () => {
  // El prefijo de `-v2` se corta en `/`. `-v3` no es `-v2`; `inventariox` no es
  // inventario.
  assert.equal(destino('/admin/inventario-v3'), null);
  assert.equal(destino('/admin/inventariox'), null);
});

// ─── EL DOBLE SALTO · destino final tras la CADENA COMPLETA ───────────────────

test('DOBLE SALTO: stock=bajo-minimo → /admin/productos?f=reponer, y AHÍ para', () => {
  // Es la primera vez en los cuatro retiros que un redirect emite un destino de
  // OTRA sección. La disjunción de matchers no basta: hay que afirmar que ese
  // destino, re-metido en la cadena COMPLETA, no se vuelve a redirigir.
  const primero = cadena('/admin/inventario?stock=bajo-minimo');
  assert.equal(primero, RUTA_REPONER);                 // primera pasada: lo captura inventario
  assert.equal(cadena(primero!), null,                 // segunda pasada: NADIE lo toca → converge
    'el destino del doble salto se re-redirige — riesgo de loop');
});

test('el `-v2` heredado también converge en una pasada', () => {
  const primero = cadena('/admin/inventario-v2?tipo=venta');
  assert.equal(primero, `${RUTA_INVENTARIO}?tipo=venta`);
  assert.equal(cadena(primero!), null);
});

// ─── LOS CUATRO REDIRECTS NO SE PISAN ────────────────────────────────────────

test('ninguna ruta matchea DOS de los CUATRO redirects, así que el orden da igual', () => {
  const rutas = [
    '/admin/inventario', '/admin/inventario-v2', '/admin/inventario?stock=bajo-minimo',
    '/admin/inventario?producto=abc',
    '/admin/productos', '/admin/productos-v2', '/admin/productos?f=reponer',
    '/admin/clientes', '/admin/clientes/abc', '/admin/clientes-v2',
    '/admin/ordenes', '/admin/ordenes?order=CN-1', '/admin/ordenes/algo',
    '/admin/pedidos', '/admin/dashboard',
  ];
  for (const r of rutas) {
    const u = new URL(r, 'https://x');
    const activos = [
      destinoDesdeOrdenes(u.pathname, u.searchParams),
      destinoDesdeClientes(u.pathname, u.searchParams),
      destinoDesdeProductos(u.pathname, u.searchParams),
      destinoDesdeInventario(u.pathname, u.searchParams),
    ].filter(d => d !== null);
    assert.ok(activos.length <= 1, `${r} cae en más de un redirect: ${activos.length}`);
  }
});

// ─── QUÉ NO INTERCEPTA ───────────────────────────────────────────────────────

test('`null` para el resto del panel', () => {
  assert.equal(destino('/admin/pedidos?pedido=CN-1'), null);
  assert.equal(destino('/admin/productos'), null);
  assert.equal(destino('/admin'), null);
});

// ─── LA TRADUCCIÓN, SUELTA ────────────────────────────────────────────────────

test('sólo el vocabulario de auditoría sobrevive; `stock` y basura se descartan', () => {
  assert.equal(
    traducirQueryDeAuditoria(new URLSearchParams('producto=x&tipo=venta&desde=2026-01-01&hasta=2026-01-31&otro=1')),
    'producto=x&tipo=venta&desde=2026-01-01&hasta=2026-01-31',
  );
  assert.equal(traducirQueryDeAuditoria(new URLSearchParams('stock=bajo-minimo')), '');
  assert.equal(traducirQueryDeAuditoria(new URLSearchParams('')), '');
});
