import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion } from '../../lib/config/site-content-write';
import { readSiteContent, readSiteContentParaEditor } from '../../lib/config/site-content-read';
import { DEFAULTS } from '../../lib/config/site-content-defaults';

// EL VIAJE DE PUNTA A PUNTA de la sección Marquesina (§ PANEL-EDITOR-MARQUESINA-1). `marquesina` SÍ
// es una sección del REGISTRY (su schema — `marquesinaEditableSchema` — ya declaraba los tres campos
// ANTES de este slice, § site-content-schema.ts, sin cambios acá), así que va por el camino GENÉRICO
// de `/api/site-content` — simulado igual que origen.test.ts / presentaciones-viaje.test.ts /
// spotlight-pin.test.ts: parsear con el schema real → `guardarBorrador` → `publicarSeccion
// ('marquesina')` → releer con `readSiteContent`, lo mismo que `Marquesina.tsx` resuelve. Prueba que
// el CONTROL nuevo (`MARQUESINA` en tienda-secciones.ts) mueve el dato de verdad hasta el
// storefront, no sólo que el editor renderiza los inputs.

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

/** Simula EXACTAMENTE el PUT de la ruta genérica: parsea el body con el schema real y guarda el
 *  resultado en el borrador. */
async function guardarComoElRoute(marquesina: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse({ marquesina });
  await guardarBorrador(parsed);
}

test('texto + imagen + productoSlug sobreviven borrador→publicar→releer, y el borrador queda limpio', async () => {
  await guardarComoElRoute({
    visible: true,
    texto: 'Tueste fresco cada semana',
    imagen: '/images/finca-1-v1.jpg',
    productoSlug: 'cafe-narino-500g',
  });
  await publicarSeccion('marquesina');

  const publicado = await readSiteContent();
  assert.equal(publicado.marquesina.visible, true, 'visible debe sobrevivir el schema y publicarse');
  assert.equal(publicado.marquesina.texto, 'Tueste fresco cada semana');
  assert.equal(publicado.marquesina.imagen, '/images/finca-1-v1.jpg');
  assert.equal(publicado.marquesina.productoSlug, 'cafe-narino-500g');

  const { sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.marquesina, false, 'publicar debe limpiar el borrador de la sección marquesina');
});

test('productoSlug vacío se OMITE (opcional) — el pin cae a "" y la tarjeta flotante no se muestra', async () => {
  await guardarComoElRoute({
    visible: true,
    texto: 'Café de origen único',
    imagen: '/images/finca-1-v1.jpg',
    productoSlug: '',
  });
  await publicarSeccion('marquesina');

  const publicado = await readSiteContent();
  assert.equal(publicado.marquesina.productoSlug, '', 'sin pin, productoSlug queda vacío — hide-on-empty de la tarjeta, no de la sección');
  assert.equal(publicado.marquesina.texto, 'Café de origen único', 'el texto del loop no depende del pin');
});

test('sin fila: marquesina resuelve byte-idéntico a DEFAULTS.marquesina (visible sigue en false, "nace OFF")', async () => {
  const publicado = await readSiteContent();
  assert.deepEqual(publicado.marquesina, DEFAULTS.marquesina, 'sin fila, marquesina debe ser byte-idéntico al default');
});
