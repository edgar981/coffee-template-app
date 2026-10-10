import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion } from '../../lib/config/site-content-write';
import { readSiteContent } from '../../lib/config/site-content-read';

// EL VIAJE DE PUNTA A PUNTA DE LA CARTELERA DE ONIX (§ TIENDA-ONIX-CARTELERA-1): el editor manda el
// form → el ROUTE lo pasa por `siteContentEditableSchema` → `guardarBorrador` → `publicarSeccion` →
// y el visitante lo lee por `readSiteContent`. Mismo criterio que `tienda-chamisas-viaje.test.ts`: un
// test que llame a `guardarBorrador` DIRECTO no atraparía un schema que STRIPPEA en silencio un campo
// nuevo (§ #65-B) — hay que pasar por el schema real, como el route. Cubre las CINCO piezas nuevas
// que esa tanda no conoce: Apertura (tiendaEncabezado), Taquilla (tiendaCatalogo.barraFijaMovil), la
// sección NUEVA Créditos, Plano (tiendaInterludio) y Frase y botón (tiendaCierre).

type Seccion = 'tiendaEncabezado' | 'tiendaCatalogo' | 'tiendaCreditos' | 'tiendaInterludio' | 'tiendaCierre';

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

// Simula EXACTAMENTE el paso del route: parsea el body con el schema real (donde zod strippearía lo
// no declarado) y guarda el resultado. Si el schema strippea un campo, no llega a `guardarBorrador`.
async function guardarComoElRoute(seccion: Seccion, data: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse({ [seccion]: data });
  await guardarBorrador(parsed);
}

// ─── APERTURA (tiendaEncabezado) — imagen/rótulos/variante, y titulo OPCIONAL ──────────────────────

test('tiendaEncabezado «Apertura» de punta a punta: titulo/imagen/rotuloIzquierda/rotuloDerecha/variante sobreviven borrador→publicar→releer', async () => {
  await guardarComoElRoute('tiendaEncabezado', {
    titulo: 'Finca San Adolfo', imagen: 'https://blob.example/finca.jpg',
    rotuloIzquierda: 'Cosecha 2026', rotuloDerecha: 'San Adolfo, Huila', variante: 'apertura',
  });
  await publicarSeccion('tiendaEncabezado');

  const encabezado = (await readSiteContent()).tiendaEncabezado;
  assert.equal(encabezado.titulo, 'Finca San Adolfo');
  assert.equal(encabezado.imagen, 'https://blob.example/finca.jpg');
  assert.equal(encabezado.rotuloIzquierda, 'Cosecha 2026');
  assert.equal(encabezado.rotuloDerecha, 'San Adolfo, Huila');
  assert.equal(encabezado.variante, 'apertura');
});

test('tiendaEncabezado.titulo: GUARDADO VACÍO se omite (opcional) — no cae al literal "Nuestra Tienda" del resolver (el fallback a negocio es del componente)', async () => {
  await guardarComoElRoute('tiendaEncabezado', { titulo: '', variante: 'apertura' });
  await publicarSeccion('tiendaEncabezado');

  const encabezado = (await readSiteContent()).tiendaEncabezado;
  assert.equal(encabezado.titulo, '');
  assert.equal(encabezado.variante, 'apertura');
});

test('tiendaEncabezado: sin publicar nada, nace en "actual" con imagen/rótulos vacíos (byte-idéntico)', async () => {
  const sinFila = await readSiteContent();
  assert.equal(sinFila.tiendaEncabezado.variante, 'actual');
  assert.equal(sinFila.tiendaEncabezado.titulo, 'Nuestra Tienda');
  assert.equal(sinFila.tiendaEncabezado.imagen, '');
  assert.equal(sinFila.tiendaEncabezado.rotuloIzquierda, '');
  assert.equal(sinFila.tiendaEncabezado.rotuloDerecha, '');
});

// ─── TAQUILLA (tiendaCatalogo.barraFijaMovil) ──────────────────────────────────────────────────────

test('tiendaCatalogo «Taquilla»: variante y barraFijaMovil sobreviven borrador→publicar→releer', async () => {
  await guardarComoElRoute('tiendaCatalogo', { variante: 'taquilla', barraFijaMovil: false });
  await publicarSeccion('tiendaCatalogo');

  const catalogo = (await readSiteContent()).tiendaCatalogo;
  assert.equal(catalogo.variante, 'taquilla');
  assert.equal(catalogo.barraFijaMovil, false);
});

test('tiendaCatalogo: sin publicar nada, barraFijaMovil nace ENCENDIDA (byte-idéntico, § el default de arranque)', async () => {
  const sinFila = await readSiteContent();
  assert.equal(sinFila.tiendaCatalogo.variante, 'actual');
  assert.equal(sinFila.tiendaCatalogo.barraFijaMovil, true);
});

// ─── LA SECCIÓN NUEVA: CRÉDITOS (ficha de origen) ──────────────────────────────────────────────────

test('tiendaCreditos de punta a punta: visible/items sobreviven borrador→publicar→releer', async () => {
  const items = [
    { etiqueta: 'Origen', valor: 'San Adolfo, Huila' },
    { etiqueta: 'Altitud', valor: '1.500 – 1.800 msnm' },
    { etiqueta: 'Proceso', valor: 'Lavado, secado al sol' },
  ];
  await guardarComoElRoute('tiendaCreditos', { visible: true, items });
  await publicarSeccion('tiendaCreditos');

  const creditos = (await readSiteContent()).tiendaCreditos;
  assert.equal(creditos.visible, true);
  assert.deepEqual(creditos.items, items);
});

test('tiendaCreditos: sin publicar nada, nace sin filas (byte-idéntico — ningún dato de finca en el código)', async () => {
  const sinFila = await readSiteContent();
  assert.equal(sinFila.tiendaCreditos.visible, true);
  assert.deepEqual(sinFila.tiendaCreditos.items, []);
});

// ─── PLANO (tiendaInterludio) — pie + variante, reusa imagen ───────────────────────────────────────

test('tiendaInterludio «Plano» de punta a punta: imagen/pie/variante sobreviven borrador→publicar→releer', async () => {
  await guardarComoElRoute('tiendaInterludio', {
    visible: true, imagen: 'https://blob.example/cerezas.jpg',
    pie: 'Recolección a mano · marzo–junio', variante: 'plano',
  });
  await publicarSeccion('tiendaInterludio');

  const interludio = (await readSiteContent()).tiendaInterludio;
  assert.equal(interludio.visible, true);
  assert.equal(interludio.imagen, 'https://blob.example/cerezas.jpg');
  assert.equal(interludio.pie, 'Recolección a mano · marzo–junio');
  assert.equal(interludio.variante, 'plano');
});

test('tiendaInterludio: sin publicar nada, variante resuelve a "retrato" (la canónica) con pie vacío', async () => {
  const sinFila = await readSiteContent();
  assert.equal(sinFila.tiendaInterludio.variante, 'retrato');
  assert.equal(sinFila.tiendaInterludio.pie, '');
});

// ─── FRASE Y BOTÓN (tiendaCierre) — variante, sin campos propios ───────────────────────────────────

test('tiendaCierre «Frase y botón» de punta a punta: frase/boton/variante sobreviven borrador→publicar→releer, SIN franjaTejido', async () => {
  await guardarComoElRoute('tiendaCierre', {
    visible: true, frase: 'El mismo café, cada mes.', boton: 'Escríbenos', variante: 'fraseYBoton',
  });
  await publicarSeccion('tiendaCierre');

  const cierre = (await readSiteContent()).tiendaCierre;
  assert.equal(cierre.visible, true);
  assert.equal(cierre.frase, 'El mismo café, cada mes.');
  assert.equal(cierre.boton, 'Escríbenos');
  assert.equal(cierre.variante, 'fraseYBoton');
  assert.equal(cierre.franjaTejido, ''); // nunca se tocó — sigue vacío
});

test('tiendaCierre: sin publicar nada, variante resuelve a "costura" (la canónica)', async () => {
  const sinFila = await readSiteContent();
  assert.equal(sinFila.tiendaCierre.variante, 'costura');
});

// ─── EL BORRADOR ES PARCIAL POR SECCIÓN — publicar una no publica las demás ───────────────────────

test('publicar tiendaEncabezado NO publica tiendaCreditos ni tiendaCierre (el borrador es parcial por sección)', async () => {
  await guardarComoElRoute('tiendaEncabezado', { variante: 'apertura', titulo: 'Finca San Adolfo' });
  await guardarComoElRoute('tiendaCreditos', { visible: true, items: [{ etiqueta: 'Origen', valor: 'Sin publicar' }] });
  await guardarComoElRoute('tiendaCierre', { visible: true, variante: 'fraseYBoton' });
  await publicarSeccion('tiendaEncabezado');

  const contenido = await readSiteContent();
  assert.equal(contenido.tiendaEncabezado.variante, 'apertura');
  assert.equal(contenido.tiendaEncabezado.titulo, 'Finca San Adolfo');
  // Las otras dos se quedaron en borrador — lo publicado sigue siendo el default de hoy.
  assert.deepEqual(contenido.tiendaCreditos.items, []);
  assert.equal(contenido.tiendaCierre.variante, 'costura');
});
