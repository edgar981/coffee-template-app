import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinoDesdeConfig, RUTA_USUARIOS, RUTA_CONFIG } from '@/lib/redirect-config';
import { destinoDesdeOrdenes } from '@/lib/redirect-ordenes';
import { destinoDesdeClientes } from '@/lib/redirect-clientes';
import { destinoDesdeProductos } from '@/lib/redirect-productos';
import { destinoDesdeInventario } from '@/lib/redirect-inventario';
import { destinoDesdeEntregas } from '@/lib/redirect-entregas';

// La traducción es pura; se afirma entera sin montar un request. `proxy.ts` sólo
// agrega el 307 y el orden respecto de la sesión.
const destino = (url: string) => {
  const u = new URL(url, 'https://x');
  return destinoDesdeConfig(u.pathname, u.searchParams);
};

// LA CADENA COMPLETA de proxy.ts, en su orden, para afirmar el DESTINO FINAL —no
// sólo que los matchers no se pisen—.
const cadena = (url: string): string | null => {
  const u = new URL(url, 'https://x');
  return destinoDesdeOrdenes(u.pathname, u.searchParams)
    ?? destinoDesdeClientes(u.pathname, u.searchParams)
    ?? destinoDesdeProductos(u.pathname, u.searchParams)
    ?? destinoDesdeInventario(u.pathname, u.searchParams)
    ?? destinoDesdeEntregas(u.pathname, u.searchParams)
    ?? destinoDesdeConfig(u.pathname, u.searchParams);
};

// ─── LA SUBRUTA RETIRADA ─────────────────────────────────────────────────────

test('la subruta de usuarios va a la ruta que hospeda el equipo', () => {
  assert.equal(destino(RUTA_USUARIOS), RUTA_CONFIG);
});

test('el query se descarta (nunca hubo uno) — sin filtro, nunca 404', () => {
  assert.equal(destino(`${RUTA_USUARIOS}?x=1&y=2`), RUTA_CONFIG);
});

// ─── LA TRAMPA DEL BUCLE ─────────────────────────────────────────────────────

test('la ruta destino NO se redirige: es donde vive la pantalla, y redirigirla es un bucle', () => {
  assert.equal(destino(RUTA_CONFIG), null);
});

test('DESTINO FINAL: la subruta converge en una pasada por la cadena completa', () => {
  const primero = cadena(RUTA_USUARIOS);
  assert.equal(primero, RUTA_CONFIG);        // primera pasada: lo captura config
  assert.equal(cadena(primero!), null,       // segunda pasada: NADIE lo toca → converge
    'el destino se re-redirige — riesgo de loop');
});

// ─── EL SEGMENTO, NO EL PREFIJO ──────────────────────────────────────────────

test('no intercepta una ruta que sólo EMPIEZA parecido', () => {
  assert.equal(destino('/admin/configuracion/usuarios-x'), null);
  assert.equal(destino('/admin/configuracionx'), null);
});

// ─── NO SE PISA CON LOS OTROS CINCO ──────────────────────────────────────────

test('ninguna de las dos rutas de config cae en más de un redirect', () => {
  for (const r of [RUTA_USUARIOS, RUTA_CONFIG]) {
    const u = new URL(r, 'https://x');
    const activos = [
      destinoDesdeOrdenes(u.pathname, u.searchParams),
      destinoDesdeClientes(u.pathname, u.searchParams),
      destinoDesdeProductos(u.pathname, u.searchParams),
      destinoDesdeInventario(u.pathname, u.searchParams),
      destinoDesdeEntregas(u.pathname, u.searchParams),
      destinoDesdeConfig(u.pathname, u.searchParams),
    ].filter(d => d !== null);
    assert.ok(activos.length <= 1, `${r} cae en más de un redirect: ${activos.length}`);
  }
});

// ─── QUÉ NO INTERCEPTA ───────────────────────────────────────────────────────

test('`null` para el resto del panel', () => {
  assert.equal(destino('/admin/perfil'), null);
  assert.equal(destino('/admin/pedidos'), null);
  assert.equal(destino('/admin'), null);
});
