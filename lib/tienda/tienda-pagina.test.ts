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

// § TIENDA-CHAMISAS-ALBUM-1 sumó la segunda composición de cada sección («Carta»/«Láminas»);
// § TIENDA-ONIX-CARTELERA-1 sumó la TERCERA («Apertura»/«Taquilla») — este test documentaba la
// premisa "sólo existe «Actual»" de la tanda original, y esa tanda ya anticipaba el cambio: "deja
// el slot de composición listo para que un slice futuro agregue Cartel/Taquilla sin tocar el
// resolver". Lo que sigue siendo cierto, y lo que este test afirma ahora, es que «actual» SIGUE
// siendo la CANÓNICA (el default, byte-idéntico sin fila) — cada composición nueva es una clave
// MÁS, nunca el reemplazo.
test('REGISTRY.tiendaEncabezado/.tiendaCatalogo: "actual" sigue siendo la CANÓNICA, con la tercera composición sumada', () => {
  assert.deepEqual(REGISTRY.tiendaEncabezado.variantes?.claves, ['actual', 'carta', 'apertura']);
  assert.equal(REGISTRY.tiendaEncabezado.variantes?.canonica, 'actual');
  assert.deepEqual(REGISTRY.tiendaCatalogo.variantes?.claves, ['actual', 'laminas', 'taquilla']);
  assert.equal(REGISTRY.tiendaCatalogo.variantes?.canonica, 'actual');
});

test('cada SeccionConfig de /tienda ofrece «Actual» PRIMERO, y ahora TRES composiciones — "actual" nunca fuera del primer lugar', () => {
  const encabezado = SECCIONES_TIENDA.find((c) => c.seccion === 'tiendaEncabezado')!;
  const catalogo = SECCIONES_TIENDA.find((c) => c.seccion === 'tiendaCatalogo')!;
  assert.equal(encabezado.composiciones?.length, 3);
  assert.equal(encabezado.composiciones?.[0].value, 'actual');
  assert.equal(encabezado.composiciones?.[1].value, 'carta');
  assert.equal(encabezado.composiciones?.[2].value, 'apertura');
  assert.equal(catalogo.composiciones?.length, 3);
  assert.equal(catalogo.composiciones?.[0].value, 'actual');
  assert.equal(catalogo.composiciones?.[1].value, 'laminas');
  assert.equal(catalogo.composiciones?.[2].value, 'taquilla');
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

// `titulo` PASÓ A OPCIONAL (§ TIENDA-ONIX-CARTELERA-1, para que "Apertura" pueda caer al nombre del
// negocio en vez de un texto de código): a nivel de RESOLVER, un `titulo` guardado vacío YA NO cae
// al default — se omite (`''`), como cualquier campo opcional. El fallback a 'Nuestra Tienda' para
// «Actual»/«Carta» sigue existiendo, pero se movió al COMPONENTE (`TiendaEncabezado.tsx`), no a este
// resolver — por eso este test, que mide sólo el resolver, cambia de expectativa. `leyenda` sigue
// requerida y sigue cayendo al default acá mismo.
test('tiendaEncabezado.titulo vacío se OMITE en el resolver (opcional, § Apertura); leyenda vacía sigue cayendo al default (requerida)', () => {
  const r = resolverSiteContent({ tiendaEncabezado: { titulo: '', leyenda: '' } });
  assert.equal(r.tiendaEncabezado.titulo, '');
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
  // 'taquilla' es, desde § TIENDA-ONIX-CARTELERA-1, una clave VÁLIDA (ya no basura) — la basura de
  // este caso pasa a ser un nombre que el set cerrado nunca tuvo.
  assert.equal(resolverSiteContent({ tiendaCatalogo: { variante: 'mosaico' } }).tiendaCatalogo.variante, 'actual');
});

// ─── EL BUSCADOR NO ES CONTENIDO (§ el docstring de TiendaCatalogoContent) — no hay campo que leer ─

test('tiendaCatalogo no declara un campo de placeholder de búsqueda (sigue siendo literal en el componente, § la desviación medida)', () => {
  assert.equal('buscarPlaceholder' in DEFAULTS.tiendaCatalogo, false);
  assert.equal('buscarPlaceholder' in REGISTRY.tiendaCatalogo.campos, false);
});
