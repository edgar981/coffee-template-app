import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion } from '../../lib/config/site-content-write';
import { readSiteContent } from '../../lib/config/site-content-read';

// EL VIAJE DE PUNTA A PUNTA de /tienda (§ TIENDA-PAGINA-REGISTRO-1): el editor manda el form → el
// ROUTE lo pasa por `siteContentEditableSchema` → `guardarBorrador` → `publicarSeccion` → y el
// visitante lo lee por `readSiteContent`. Mismo criterio que `presentaciones-viaje.test.ts` (§
// #65-B): un test que llame a `guardarBorrador` DIRECTO no atraparía un schema que STRIPPEA en
// silencio un campo nuevo — hay que pasar por el schema real, como el route.

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

// Simula EXACTAMENTE el paso del route: parsea el body con el schema real (donde zod strippearía lo
// no declarado) y guarda el resultado. Si el schema strippea un campo, no llega a `guardarBorrador`.
async function guardarComoElRoute(seccion: 'tiendaEncabezado' | 'tiendaCatalogo', data: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse({ [seccion]: data });
  await guardarBorrador(parsed);
}

test('tiendaEncabezado de punta a punta: titulo/leyenda sobreviven borrador→publicar→releer', async () => {
  await guardarComoElRoute('tiendaEncabezado', { titulo: 'Catálogo de Onix', leyenda: 'Hecho a mano' });
  await publicarSeccion('tiendaEncabezado');

  const encabezado = (await readSiteContent()).tiendaEncabezado;
  assert.equal(encabezado.titulo, 'Catálogo de Onix', 'titulo debe sobrevivir el schema y el viaje');
  assert.equal(encabezado.leyenda, 'Hecho a mano', 'leyenda debe sobrevivir el schema y el viaje');
  // Sanity: distinto del default, así que la aserción prueba algo (no un valor que ya estaba).
  assert.notEqual(encabezado.titulo, 'Nuestra Tienda');
});

test('tiendaCatalogo de punta a punta: vacioTitulo/vacioTexto sobreviven borrador→publicar→releer', async () => {
  await guardarComoElRoute('tiendaCatalogo', { vacioTitulo: 'Nada por acá', vacioTexto: 'Prueba otra palabra.' });
  await publicarSeccion('tiendaCatalogo');

  const catalogo = (await readSiteContent()).tiendaCatalogo;
  assert.equal(catalogo.vacioTitulo, 'Nada por acá');
  assert.equal(catalogo.vacioTexto, 'Prueba otra palabra.');
  assert.notEqual(catalogo.vacioTitulo, 'Sin resultados');
});

// EL CAMPO DE COMPOSICIÓN (§ el spec de este slice: "sin que el schema descarte el campo de
// composición") — `variante` es un campo MÁS que `z.object` STRIPPEARÍA en silencio si no estuviera
// declarado (§ #65-B, el mismo defecto que ya mordió a `presentaciones.variante`). Hoy el único
// valor válido es 'actual' (la única composición), pero el schema debe conservarlo tal cual viaja —
// el clamp a la canónica es trabajo del RESOLVER (`resolverVariante`), no del schema.
test('tiendaEncabezado.variante sobrevive el schema (no lo descarta en silencio)', async () => {
  await guardarComoElRoute('tiendaEncabezado', { titulo: 'X', variante: 'actual' });
  await publicarSeccion('tiendaEncabezado');

  const encabezado = (await readSiteContent()).tiendaEncabezado;
  assert.equal(encabezado.variante, 'actual');
});

test('tiendaCatalogo.variante sobrevive el schema (no lo descarta en silencio)', async () => {
  await guardarComoElRoute('tiendaCatalogo', { vacioTitulo: 'X', variante: 'actual' });
  await publicarSeccion('tiendaCatalogo');

  const catalogo = (await readSiteContent()).tiendaCatalogo;
  assert.equal(catalogo.variante, 'actual');
});

// SIN FILA PUBLICADA: el visitante sigue viendo el texto de HOY (byte-idéntico, § el spec). Publicar
// UNA sección no debe arrastrar a la otra con contenido a medias.
test('sin publicar nada, el visitante lee el texto de hoy en las dos secciones', async () => {
  const contenido = await readSiteContent();
  assert.equal(contenido.tiendaEncabezado.titulo, 'Nuestra Tienda');
  assert.equal(contenido.tiendaEncabezado.leyenda, 'Origen colombiano');
  assert.equal(contenido.tiendaCatalogo.vacioTitulo, 'Sin resultados');
  assert.equal(contenido.tiendaCatalogo.vacioTexto, 'Prueba con otros filtros o términos de búsqueda.');
});

test('publicar tiendaEncabezado NO publica tiendaCatalogo (el borrador es parcial por sección)', async () => {
  await guardarComoElRoute('tiendaEncabezado', { titulo: 'Sólo encabezado' });
  await guardarComoElRoute('tiendaCatalogo', { vacioTitulo: 'Borrador sin publicar' });
  await publicarSeccion('tiendaEncabezado');

  const contenido = await readSiteContent();
  assert.equal(contenido.tiendaEncabezado.titulo, 'Sólo encabezado');
  // tiendaCatalogo se quedó en borrador — lo publicado sigue siendo el default de hoy.
  assert.equal(contenido.tiendaCatalogo.vacioTitulo, 'Sin resultados');
});
