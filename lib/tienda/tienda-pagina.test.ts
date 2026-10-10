import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolverSiteContent, REGISTRY, DEFAULTS } from '@/lib/config/site-content-defaults';
import { SECCIONES_TIENDA, PAGINAS } from '@/components/admin/tienda-secciones';

// § TIENDA-PAGINA-REGISTRO-1 — /tienda entra al editor como una página más, partida en secciones
// (encabezado + catálogo) que leen SiteContent. Esto afirma el CARRIL RÁPIDO (capa 1, sin base): que
// las dos secciones resuelven sus DEFAULTS, que la única composición es «Actual», y que sin fila el
// resultado es el de hoy — byte-idéntico, § el spec de este slice.

test('PAGINAS incluye "tienda", no apagable — el catálogo ES la tienda', () => {
  const tienda = PAGINAS.find((p) => p.key === 'tienda');
  assert.ok(tienda, 'PAGINAS debe declarar la página "tienda"');
  assert.equal(tienda!.apagable, false);
});

test('SECCIONES_TIENDA declara tiendaEncabezado y tiendaCatalogo en la página "tienda"', () => {
  const encabezado = SECCIONES_TIENDA.find((c) => c.seccion === 'tiendaEncabezado');
  const catalogo = SECCIONES_TIENDA.find((c) => c.seccion === 'tiendaCatalogo');
  assert.ok(encabezado, 'falta la SeccionConfig de tiendaEncabezado');
  assert.ok(catalogo, 'falta la SeccionConfig de tiendaCatalogo');
  assert.equal(encabezado!.pagina, 'tienda');
  assert.equal(catalogo!.pagina, 'tienda');
  assert.equal(encabezado!.ocultable, false);
  assert.equal(catalogo!.ocultable, false);
});

// § TIENDA-CHAMISAS-ALBUM-1 GANÓ la segunda composición de cada sección («Carta»/«Láminas») —
// este test documentaba la premisa "sólo existe «Actual»" de la tanda anterior, y ESE slice ya
// anticipaba el cambio: "deja el slot de composición listo para que un slice futuro agregue
// Cartel/Taquilla sin tocar el resolver". Lo que sigue siendo cierto, y lo que este test afirma
// ahora, es que «actual» SIGUE siendo la CANÓNICA (el default, byte-idéntico sin fila) — la
// composición nueva es la SEGUNDA clave, nunca el reemplazo.
test('REGISTRY.tiendaEncabezado/.tiendaCatalogo: "actual" sigue siendo la CANÓNICA, con una segunda composición sumada', () => {
  assert.deepEqual(REGISTRY.tiendaEncabezado.variantes?.claves, ['actual', 'carta']);
  assert.equal(REGISTRY.tiendaEncabezado.variantes?.canonica, 'actual');
  assert.deepEqual(REGISTRY.tiendaCatalogo.variantes?.claves, ['actual', 'laminas']);
  assert.equal(REGISTRY.tiendaCatalogo.variantes?.canonica, 'actual');
});

test('cada SeccionConfig de /tienda ofrece «Actual» PRIMERO, y una segunda composición — nunca menos de dos, nunca "actual" fuera del primer lugar', () => {
  const encabezado = SECCIONES_TIENDA.find((c) => c.seccion === 'tiendaEncabezado')!;
  const catalogo = SECCIONES_TIENDA.find((c) => c.seccion === 'tiendaCatalogo')!;
  assert.equal(encabezado.composiciones?.length, 2);
  assert.equal(encabezado.composiciones?.[0].value, 'actual');
  assert.equal(encabezado.composiciones?.[1].value, 'carta');
  assert.equal(catalogo.composiciones?.length, 2);
  assert.equal(catalogo.composiciones?.[0].value, 'actual');
  assert.equal(catalogo.composiciones?.[1].value, 'laminas');
});

// ─── SIN FILA → el resultado es el DE HOY (byte-idéntico) ─────────────────────────────────────────

test('sin fila de SiteContent, tiendaEncabezado resuelve el texto EXACTO de hoy', () => {
  const r = resolverSiteContent({});
  assert.equal(r.tiendaEncabezado.titulo, 'Nuestra Tienda');
  assert.equal(r.tiendaEncabezado.leyenda, 'Origen colombiano');
  assert.equal(r.tiendaEncabezado.variante, 'actual');
});

test('sin fila de SiteContent, tiendaCatalogo resuelve el texto EXACTO de hoy', () => {
  const r = resolverSiteContent({});
  assert.equal(r.tiendaCatalogo.vacioTitulo, 'Sin resultados');
  assert.equal(r.tiendaCatalogo.vacioTexto, 'Prueba con otros filtros o términos de búsqueda.');
  assert.equal(r.tiendaCatalogo.variante, 'actual');
});

test('DEFAULTS.tiendaEncabezado/.tiendaCatalogo coinciden con lo que resolverSiteContent({}) devuelve (no hay un segundo default divergente)', () => {
  const r = resolverSiteContent({});
  assert.deepEqual(r.tiendaEncabezado, DEFAULTS.tiendaEncabezado);
  assert.deepEqual(r.tiendaCatalogo, DEFAULTS.tiendaCatalogo);
});

// ─── CAMPOS REQUERIDOS: vacío cae al default (el storefront nunca queda sin texto) ────────────────

test('tiendaEncabezado.titulo/leyenda vacíos caen al default — requerido, nunca en blanco', () => {
  const r = resolverSiteContent({ tiendaEncabezado: { titulo: '', leyenda: '' } });
  assert.equal(r.tiendaEncabezado.titulo, 'Nuestra Tienda');
  assert.equal(r.tiendaEncabezado.leyenda, 'Origen colombiano');
});

test('tiendaCatalogo.vacioTitulo/vacioTexto vacíos caen al default — requerido, nunca en blanco', () => {
  const r = resolverSiteContent({ tiendaCatalogo: { vacioTitulo: '', vacioTexto: '' } });
  assert.equal(r.tiendaCatalogo.vacioTitulo, 'Sin resultados');
  assert.equal(r.tiendaCatalogo.vacioTexto, 'Prueba con otros filtros o términos de búsqueda.');
});

// ─── UN VALOR GUARDADO SOBREVIVE (el editor puede, de hecho, cambiar el texto) ────────────────────

test('un titulo/leyenda guardados sobreviven al resolver', () => {
  const r = resolverSiteContent({ tiendaEncabezado: { titulo: 'Catálogo', leyenda: 'Hecho a mano' } });
  assert.equal(r.tiendaEncabezado.titulo, 'Catálogo');
  assert.equal(r.tiendaEncabezado.leyenda, 'Hecho a mano');
});

test('un vacioTitulo/vacioTexto guardados sobreviven al resolver', () => {
  const r = resolverSiteContent({ tiendaCatalogo: { vacioTitulo: 'Nada por acá', vacioTexto: 'Prueba otra búsqueda.' } });
  assert.equal(r.tiendaCatalogo.vacioTitulo, 'Nada por acá');
  assert.equal(r.tiendaCatalogo.vacioTexto, 'Prueba otra búsqueda.');
});

// ─── LA VARIANTE: basura/ausente cae a la canónica, sin lanzar ────────────────────────────────────

test('tiendaEncabezado.variante: basura/ausente cae a "actual", nunca lanza', () => {
  assert.equal(resolverSiteContent({}).tiendaEncabezado.variante, 'actual');
  assert.equal(resolverSiteContent({ tiendaEncabezado: { variante: 'cartel' } }).tiendaEncabezado.variante, 'actual');
  assert.equal(resolverSiteContent({ tiendaEncabezado: { variante: null } }).tiendaEncabezado.variante, 'actual');
});

test('tiendaCatalogo.variante: basura/ausente cae a "actual", nunca lanza', () => {
  assert.equal(resolverSiteContent({}).tiendaCatalogo.variante, 'actual');
  assert.equal(resolverSiteContent({ tiendaCatalogo: { variante: 'taquilla' } }).tiendaCatalogo.variante, 'actual');
});

// ─── EL BUSCADOR NO ES CONTENIDO (§ el docstring de TiendaCatalogoContent) — no hay campo que leer ─

test('tiendaCatalogo no declara un campo de placeholder de búsqueda (sigue siendo literal en el componente, § la desviación medida)', () => {
  assert.equal('buscarPlaceholder' in DEFAULTS.tiendaCatalogo, false);
  assert.equal('buscarPlaceholder' in REGISTRY.tiendaCatalogo.campos, false);
});
