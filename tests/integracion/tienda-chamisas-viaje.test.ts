import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion } from '../../lib/config/site-content-write';
import { readSiteContent } from '../../lib/config/site-content-read';
import { REGISTRY, seccionEsVisible } from '../../lib/config/site-content-defaults';
import { tiendaInterludioVisible, tiendaCierreVisible } from '../../lib/tienda/tienda-cierre';

// EL VIAJE DE PUNTA A PUNTA del ÁLBUM DE LÁMINAS (§ TIENDA-CHAMISAS-ALBUM-1): el editor manda el
// form → el ROUTE lo pasa por `siteContentEditableSchema` → `guardarBorrador` → `publicarSeccion` →
// y el visitante lo lee por `readSiteContent`. Mismo criterio que `tienda-pagina-viaje.test.ts`
// (§ TIENDA-PAGINA-REGISTRO-1): un test que llame a `guardarBorrador` DIRECTO no atraparía un
// schema que STRIPPEA en silencio un campo nuevo (§ #65-B) — hay que pasar por el schema real, como
// el route. Cubre las TRES piezas nuevas que ese test no conoce: el mapa `coloresPorProducto`, los
// tres campos de «Carta», y las DOS secciones nuevas (Interludio, Cierre).

type Seccion = 'tiendaEncabezado' | 'tiendaCatalogo' | 'tiendaInterludio' | 'tiendaCierre';

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

// Simula EXACTAMENTE el paso del route: parsea el body con el schema real (donde zod strippearía lo
// no declarado) y guarda el resultado. Si el schema strippea un campo, no llega a `guardarBorrador`.
async function guardarComoElRoute(seccion: Seccion, data: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse({ [seccion]: data });
  await guardarBorrador(parsed);
}

// ─── EL MAPA `coloresPorProducto` — el schema NO lo strippea, el resolver lo filtra SOFT ──────────

test('tiendaCatalogo.coloresPorProducto de punta a punta: un mapa válido sobrevive borrador→publicar→releer', async () => {
  const coloresPorProducto = { 'prod-bourbon': '#f4b3c2', 'prod-pacamara': '#9ac77a' };
  await guardarComoElRoute('tiendaCatalogo', { coloresPorProducto, variante: 'laminas' });
  await publicarSeccion('tiendaCatalogo');

  const catalogo = (await readSiteContent()).tiendaCatalogo;
  assert.deepEqual(catalogo.coloresPorProducto, coloresPorProducto);
  assert.equal(catalogo.variante, 'laminas');
});

test('tiendaCatalogo.coloresPorProducto: una entrada con hex INVÁLIDO se filtra al LEER, no al guardar (el resolver, no el schema)', async () => {
  await guardarComoElRoute('tiendaCatalogo', { coloresPorProducto: { 'prod-x': 'no-es-hex', 'prod-y': '#abcdef' } });
  await publicarSeccion('tiendaCatalogo');

  const catalogo = (await readSiteContent()).tiendaCatalogo;
  assert.deepEqual(catalogo.coloresPorProducto, { 'prod-y': '#abcdef' });
});

test('tiendaCatalogo.coloresPorProducto: sin publicar nada, el visitante lee el mapa VACÍO de hoy (byte-idéntico)', async () => {
  const contenido = await readSiteContent();
  assert.deepEqual(contenido.tiendaCatalogo.coloresPorProducto, {});
  assert.equal(contenido.tiendaCatalogo.variante, 'actual');
});

// ─── LA COMPOSICIÓN «CARTA» — sticker/intro/antojoTitulo sobreviven el viaje completo ─────────────

test('tiendaEncabezado «Carta» de punta a punta: sticker/intro/antojoTitulo/variante sobreviven borrador→publicar→releer', async () => {
  await guardarComoElRoute('tiendaEncabezado', {
    titulo: 'nuestros tres cafés', sticker: 'cosecha 2026', intro: 'Lo cultivamos mujeres y familias.',
    antojoTitulo: '¿Qué te provoca?', variante: 'carta',
  });
  await publicarSeccion('tiendaEncabezado');

  const encabezado = (await readSiteContent()).tiendaEncabezado;
  assert.equal(encabezado.titulo, 'nuestros tres cafés');
  assert.equal(encabezado.sticker, 'cosecha 2026');
  assert.equal(encabezado.intro, 'Lo cultivamos mujeres y familias.');
  assert.equal(encabezado.antojoTitulo, '¿Qué te provoca?');
  assert.equal(encabezado.variante, 'carta');
});

test('tiendaEncabezado: sticker/intro vacíos se OMITEN (opcionales), antojoTitulo vacío cae al default (requerido)', async () => {
  await guardarComoElRoute('tiendaEncabezado', { sticker: '', intro: '', antojoTitulo: '' });
  await publicarSeccion('tiendaEncabezado');

  const encabezado = (await readSiteContent()).tiendaEncabezado;
  assert.equal(encabezado.sticker, '');
  assert.equal(encabezado.intro, '');
  assert.equal(encabezado.antojoTitulo, '¿Qué te provoca?');
});

// ─── LAS DOS SECCIONES NUEVAS: Interludio y Cierre ────────────────────────────────────────────────

test('tiendaInterludio de punta a punta: visible/imagen/cita/firma sobreviven borrador→publicar→releer', async () => {
  await guardarComoElRoute('tiendaInterludio', {
    visible: true, imagen: 'https://blob.example/retrato.jpg', cita: 'Cada taza cuenta una historia.',
    firma: 'Marcela, vereda El Roble',
  });
  await publicarSeccion('tiendaInterludio');

  const interludio = (await readSiteContent()).tiendaInterludio;
  assert.equal(interludio.visible, true);
  assert.equal(interludio.imagen, 'https://blob.example/retrato.jpg');
  assert.equal(interludio.cita, 'Cada taza cuenta una historia.');
  assert.equal(interludio.firma, 'Marcela, vereda El Roble');
});

test('tiendaInterludio: sin publicar nada, nace ENCENDIDO pero sin imagen — se oculta SOLO (§ TIENDA-CHAMISAS-AJUSTES-1, byte-idéntico)', async () => {
  const contenido = await readSiteContent();
  assert.equal(contenido.tiendaInterludio.visible, true);
  assert.equal(contenido.tiendaInterludio.imagen, '');
  assert.equal(contenido.tiendaInterludio.cita, '');
  assert.equal(contenido.tiendaInterludio.firma, '');
  // El TOGGLE ya no basta para ocultar: el gate real es el contenido.
  assert.equal(seccionEsVisible(REGISTRY.tiendaInterludio, contenido.tiendaInterludio), true);
  assert.equal(tiendaInterludioVisible(contenido.tiendaInterludio.imagen), false);
});

test('tiendaInterludio: publicando SÓLO la imagen (sin tocar `visible`) la sección pasa a mostrarse', async () => {
  await guardarComoElRoute('tiendaInterludio', { imagen: 'https://blob.example/retrato.jpg' });
  await publicarSeccion('tiendaInterludio');

  const interludio = (await readSiteContent()).tiendaInterludio;
  assert.equal(interludio.visible, true); // nunca se tocó — sigue en su default
  assert.equal(interludio.imagen, 'https://blob.example/retrato.jpg');
  assert.equal(tiendaInterludioVisible(interludio.imagen), true);
});

test('tiendaInterludio: `visible:false` explícito esconde A PROPÓSITO una sección CON contenido', async () => {
  await guardarComoElRoute('tiendaInterludio', { visible: false, imagen: 'https://blob.example/retrato.jpg' });
  await publicarSeccion('tiendaInterludio');

  const interludio = (await readSiteContent()).tiendaInterludio;
  assert.equal(seccionEsVisible(REGISTRY.tiendaInterludio, interludio), false);
});

test('tiendaCierre de punta a punta: visible/franjaTejido/frase/boton sobreviven borrador→publicar→releer', async () => {
  await guardarComoElRoute('tiendaCierre', {
    visible: true, franjaTejido: 'https://blob.example/franja.jpg',
    frase: 'Te lo apartamos cada mes.', boton: 'Escríbenos ya',
  });
  await publicarSeccion('tiendaCierre');

  const cierre = (await readSiteContent()).tiendaCierre;
  assert.equal(cierre.visible, true);
  assert.equal(cierre.franjaTejido, 'https://blob.example/franja.jpg');
  assert.equal(cierre.frase, 'Te lo apartamos cada mes.');
  assert.equal(cierre.boton, 'Escríbenos ya');
});

test('tiendaCierre: `frase` vacía (opcional, § TIENDA-CHAMISAS-AJUSTES-1) se OMITE; `boton` vacío (requerido) cae al default; sin publicar nada nace ENCENDIDO pero oculto', async () => {
  const sinFila = await readSiteContent();
  assert.equal(sinFila.tiendaCierre.visible, true);
  assert.equal(sinFila.tiendaCierre.frase, '');
  assert.equal(sinFila.tiendaCierre.boton, 'Escríbenos');
  // El TOGGLE ya no basta para ocultar: el gate real es `frase`.
  assert.equal(seccionEsVisible(REGISTRY.tiendaCierre, sinFila.tiendaCierre), true);
  assert.equal(tiendaCierreVisible(sinFila.tiendaCierre.frase), false);

  await guardarComoElRoute('tiendaCierre', { visible: true, frase: '', boton: '' });
  await publicarSeccion('tiendaCierre');
  const cierre = (await readSiteContent()).tiendaCierre;
  assert.equal(cierre.visible, true);
  assert.equal(cierre.frase, ''); // opcional vacío → se omite, nunca cae a un default inventado
  assert.equal(cierre.boton, sinFila.tiendaCierre.boton); // requerido vacío → el default neutro
});

test('tiendaCierre: publicando SÓLO la frase (sin tocar `visible`) la sección pasa a mostrarse', async () => {
  await guardarComoElRoute('tiendaCierre', { frase: 'Te lo apartamos cada mes.' });
  await publicarSeccion('tiendaCierre');

  const cierre = (await readSiteContent()).tiendaCierre;
  assert.equal(cierre.visible, true); // nunca se tocó — sigue en su default
  assert.equal(cierre.frase, 'Te lo apartamos cada mes.');
  assert.equal(tiendaCierreVisible(cierre.frase), true);
});

test('tiendaCierre: `visible:false` explícito esconde A PROPÓSITO una sección CON contenido', async () => {
  await guardarComoElRoute('tiendaCierre', { visible: false, frase: 'Te lo apartamos cada mes.' });
  await publicarSeccion('tiendaCierre');

  const cierre = (await readSiteContent()).tiendaCierre;
  assert.equal(seccionEsVisible(REGISTRY.tiendaCierre, cierre), false);
});

// ─── EL BORRADOR ES PARCIAL POR SECCIÓN — publicar una no publica las demás ───────────────────────

test('publicar tiendaCatalogo NO publica tiendaInterludio ni tiendaCierre (el borrador es parcial por sección)', async () => {
  await guardarComoElRoute('tiendaCatalogo', { coloresPorProducto: { x: '#111111' }, variante: 'laminas' });
  await guardarComoElRoute('tiendaInterludio', { visible: true, imagen: '/sin-publicar.jpg' });
  await guardarComoElRoute('tiendaCierre', { visible: true, frase: 'Sin publicar.' });
  await publicarSeccion('tiendaCatalogo');

  const contenido = await readSiteContent();
  assert.deepEqual(contenido.tiendaCatalogo.coloresPorProducto, { x: '#111111' });
  // Las otras dos se quedaron en borrador — lo publicado sigue siendo el default de hoy: ENCENDIDAS
  // (§ TIENDA-CHAMISAS-AJUSTES-1) pero sin el contenido que se guardó en el borrador sin publicar.
  assert.equal(contenido.tiendaInterludio.visible, true);
  assert.equal(contenido.tiendaInterludio.imagen, ''); // el borrador ('/sin-publicar.jpg') NO se publicó
  assert.equal(contenido.tiendaCierre.visible, true);
  assert.equal(contenido.tiendaCierre.frase, ''); // el borrador ('Sin publicar.') NO se publicó
});
