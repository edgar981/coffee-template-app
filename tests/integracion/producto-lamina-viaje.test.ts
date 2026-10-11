import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion } from '../../lib/config/site-content-write';
import { readSiteContent } from '../../lib/config/site-content-read';

// EL VIAJE DE PUNTA A PUNTA de la composición «Lámina abierta» de la página de producto
// (§ PRODUCTO-CHAMISAS-LAMINA-1): el editor manda el form → el ROUTE lo pasa por
// `siteContentEditableSchema` → `guardarBorrador` → `publicarSeccion` → y el visitante lo lee por
// `readSiteContent`. Mismo criterio que `tienda-chamisas-viaje.test.ts`: un test que llame a
// `guardarBorrador` DIRECTO no atraparía un schema que STRIPPEA en silencio un campo nuevo (§ #65-B)
// — hay que pasar por el schema real, como el route.

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

async function guardarComoElRoute(data: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse({ tiendaProducto: data });
  await guardarBorrador(parsed);
}

test('tiendaProducto de punta a punta: variante/teInteresaTitulo sobreviven borrador→publicar→releer', async () => {
  await guardarComoElRoute({ variante: 'lamina', teInteresaTitulo: 'Nuestros favoritos' });
  await publicarSeccion('tiendaProducto');

  const producto = (await readSiteContent()).tiendaProducto;
  assert.equal(producto.variante, 'lamina');
  assert.equal(producto.teInteresaTitulo, 'Nuestros favoritos');
});

test('tiendaProducto: sin publicar nada, el visitante lee «Actual» con el título por defecto del owner (byte-idéntico)', async () => {
  const sinFila = await readSiteContent();
  assert.equal(sinFila.tiendaProducto.variante, 'actual');
  assert.equal(sinFila.tiendaProducto.teInteresaTitulo, 'Te puede interesar');
});

test('tiendaProducto: `teInteresaTitulo` vacío (requerido) cae al default al publicar, no queda en blanco', async () => {
  await guardarComoElRoute({ variante: 'lamina', teInteresaTitulo: '' });
  await publicarSeccion('tiendaProducto');

  const producto = (await readSiteContent()).tiendaProducto;
  assert.equal(producto.teInteresaTitulo, 'Te puede interesar');
});

test('tiendaProducto: publicar SÓLO el título no toca `variante` (sigue en su default, «actual»)', async () => {
  await guardarComoElRoute({ teInteresaTitulo: 'Lo que te puede gustar' });
  await publicarSeccion('tiendaProducto');

  const producto = (await readSiteContent()).tiendaProducto;
  assert.equal(producto.variante, 'actual');
  assert.equal(producto.teInteresaTitulo, 'Lo que te puede gustar');
});

test('tiendaProducto: `variante` fuera del set cerrado cae a «actual» al releer (el resolver, no el schema)', async () => {
  await guardarComoElRoute({ variante: 'cartel' });
  await publicarSeccion('tiendaProducto');

  const producto = (await readSiteContent()).tiendaProducto;
  assert.equal(producto.variante, 'actual');
});

// NO TOCA EL BORRADOR/PUBLICADO DE OTRAS SECCIONES — «Lámina abierta» reusa `tiendaCatalogo.
// coloresPorProducto`/`tiendaEncabezado.sticker`/`tiendaInterludio` EN LECTURA, pero publicar
// `tiendaProducto` no debe pisar ninguna de esas secciones (el write es POR SECCIÓN, § mezclarBorrador
// "pisa la sección entera, nunca las otras").
test('tiendaProducto: publicar esta sección no modifica tiendaCatalogo/tiendaEncabezado/tiendaInterludio', async () => {
  await guardarComoElRoute({ variante: 'lamina' });
  await publicarSeccion('tiendaProducto');

  const contenido = await readSiteContent();
  assert.equal(contenido.tiendaCatalogo.variante, 'actual');
  assert.deepEqual(contenido.tiendaCatalogo.coloresPorProducto, {});
  assert.equal(contenido.tiendaEncabezado.sticker, '');
  assert.equal(contenido.tiendaInterludio.imagen, '');
});
