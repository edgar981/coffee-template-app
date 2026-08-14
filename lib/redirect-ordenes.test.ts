import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinoDesdeOrdenes, traducirQueryDeOrdenes, RUTA_RETIRADA, RUTA_DESTINO } from './redirect-ordenes';

const destino = (url: string): string | null => {
  const u = new URL(url, 'https://panel.local');
  return destinoDesdeOrdenes(u.pathname, u.searchParams);
};

// ─── EL CASO QUE MOTIVA TODO ─────────────────────────────────────────────────
//
// Las notificaciones ya escritas llevan `/admin/ordenes?order=CN-…` congelado en
// una columna de la base. No hay backfill: o el redirect las traduce, o el día
// del borrado la mitad de la campana deja de llevar a ningún lado.

test('`?order=` → `?pedido=`, que es lo que llevan las notificaciones congeladas', () => {
  assert.equal(destino('/admin/ordenes?order=CN-132453'), '/admin/pedidos?pedido=CN-132453');
});

test('un número con caracteres raros sobrevive al viaje', () => {
  // `URLSearchParams` re-codifica al serializar; lo que importa es que el VALOR
  // llegue igual, no que la cadena se vea igual.
  const url = destino('/admin/ordenes?order=CN-1%2F2')!;
  assert.equal(new URL(url, 'https://panel.local').searchParams.get('pedido'), 'CN-1/2');
});

// ─── EL EJE DE COBRO ─────────────────────────────────────────────────────────

test('`?cobrar=1` → el carril `por_cobrar` — la misma definición, otro vocabulario', () => {
  assert.equal(destino('/admin/ordenes?cobrar=1'), '/admin/pedidos?f=por_cobrar');
});

test('`?cobrar=0` NO se traduce, y la ausencia es deliberada', () => {
  // Significaba "pendiente MENOS por-cobrar" — el recorte del widget "Órdenes
  // Pendientes", que cambió de PREGUNTA a "Necesitan atención". No hay conjunto
  // que lo reproduzca, y mandarlo a `f=atencion` afirmaría que son lo mismo.
  assert.equal(destino('/admin/ordenes?cobrar=0'), RUTA_DESTINO);
  assert.equal(destino('/admin/ordenes?estado=pendiente&cobrar=0'), '/admin/pedidos?estado=pendiente');
});

// ─── LOS QUE VIAJAN TAL CUAL ─────────────────────────────────────────────────

test('`estado`, `desde` y `hasta` pasan sin tocarse — la nueva ya los entiende', () => {
  assert.equal(
    destino('/admin/ordenes?estado=pendiente&desde=2026-08-01&hasta=2026-08-14'),
    '/admin/pedidos?estado=pendiente&desde=2026-08-01&hasta=2026-08-14',
  );
});

test('el query de un bucket de cartera llega EXACTO', () => {
  // Es el enlace que `cartera.test.ts` afirma que contiene justo las edades de su
  // bucket. Si el redirect lo tocara, ese test seguiría verde y el enlace
  // mentiría igual — por eso se afirma acá, del otro lado del viaje.
  assert.equal(
    destino('/admin/ordenes?estado=pendiente&desde=2026-07-30&hasta=2026-08-06'),
    '/admin/pedidos?estado=pendiente&desde=2026-07-30&hasta=2026-08-06',
  );
});

test('`estado` multivalor sobrevive (el enlace viejo del widget del mes)', () => {
  const url = destino('/admin/ordenes?estado=pendiente,pagado&desde=2026-08-01')!;
  assert.equal(new URL(url, 'https://panel.local').searchParams.get('estado'), 'pendiente,pagado');
});

// ─── NUNCA UN 404 ────────────────────────────────────────────────────────────

test('sin parámetros cae a la lista', () => {
  assert.equal(destino('/admin/ordenes'), RUTA_DESTINO);
});

test('un parámetro DESCONOCIDO se descarta y cae a la lista, nunca a un error', () => {
  // El que llega acá venía de un enlace que funcionaba. Una lista de más siempre
  // se puede volver a filtrar; un 404 lo deja sin nada.
  assert.equal(destino('/admin/ordenes?inventado=1&otro=x'), RUTA_DESTINO);
});

test('lo desconocido se descarta pero lo traducible del mismo query se conserva', () => {
  assert.equal(destino('/admin/ordenes?order=CN-1&inventado=1'), '/admin/pedidos?pedido=CN-1');
});

test('una subruta inventada también aterriza en la lista', () => {
  // La pantalla vieja no tenía subrutas, así que esto es un typo o un enlace
  // fabricado — y tampoco merece un 404.
  assert.equal(destino('/admin/ordenes/CN-132453'), RUTA_DESTINO);
  assert.equal(destino('/admin/ordenes/lo/que/sea'), RUTA_DESTINO);
});

test('un valor VACÍO no fabrica un parámetro vacío', () => {
  assert.equal(destino('/admin/ordenes?order='), RUTA_DESTINO);
  assert.equal(destino('/admin/ordenes?estado=&desde='), RUTA_DESTINO);
});

// ─── QUÉ NO INTERCEPTA ───────────────────────────────────────────────────────

test('`null` para cualquier otra ruta del panel — "no me toca" ≠ "te devuelvo lo mismo"', () => {
  // La distinción es la que evita un bucle si algún día el destino cambiara.
  assert.equal(destino('/admin/pedidos?pedido=CN-1'), null);
  assert.equal(destino('/admin/clientes'), null);
  assert.equal(destino('/admin'), null);
});

test('no intercepta una ruta que sólo EMPIEZA parecido', () => {
  // `/admin/ordenes-viejas` no es `/admin/ordenes`: el prefijo se corta en `/`.
  assert.equal(destino('/admin/ordenes-viejas'), null);
  assert.equal(destino('/admin/ordenesx'), null);
});

// ─── LA TRADUCCIÓN, AISLADA ──────────────────────────────────────────────────

test('`traducirQueryDeOrdenes` devuelve cadena vacía cuando no queda nada', () => {
  assert.equal(traducirQueryDeOrdenes(new URLSearchParams('basura=1')), '');
  assert.equal(traducirQueryDeOrdenes(new URLSearchParams('')), '');
});

test('la ruta retirada y su destino son constantes, no literales repetidos', () => {
  assert.equal(RUTA_RETIRADA, '/admin/ordenes');
  assert.equal(RUTA_DESTINO, '/admin/pedidos');
});
