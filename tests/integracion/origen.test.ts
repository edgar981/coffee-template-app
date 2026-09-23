import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion } from '../../lib/config/site-content-write';
import { readSiteContent, readSiteContentParaEditor } from '../../lib/config/site-content-read';
import { DEFAULTS } from '../../lib/config/site-content-defaults';

// EL VIAJE DE PUNTA A PUNTA de la sección Origen (§ PANEL-EDITOR-ORIGEN-1). `origen` SÍ es una
// sección del REGISTRY (a diferencia del Encabezado, § panel-encabezado.test.ts), así que va por el
// camino GENÉRICO de `/api/site-content` — simulado igual que presentaciones-viaje.test.ts /
// menu-badge.test.ts / spotlight-pin.test.ts: parsear con el schema real (`origenEditableSchema` ya
// declaraba los 20 campos ANTES de este slice, § site-content-schema.ts — sin cambios acá) →
// `guardarBorrador` → `publicarSeccion('origen')` → releer con `readSiteContent`, lo mismo que
// `Origen.tsx` resuelve. Prueba que el CONTROL nuevo (`ORIGEN` en tienda-secciones.ts) mueve el dato
// de verdad hasta el storefront, no sólo que el editor renderiza los inputs.

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

/** Simula EXACTAMENTE el PUT de la ruta genérica: parsea el body con el schema real y guarda el
 *  resultado en el borrador. */
async function guardarComoElRoute(origen: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse({ origen });
  await guardarBorrador(parsed);
}

test('subconjunto representativo (texto + foto + dato + cifra) sobrevive borrador→publicar→releer, y el borrador queda limpio', async () => {
  await guardarComoElRoute({
    visible: true,
    titulo: 'Un origen real, de principio a fin',
    imagen1: '/images/finca-1-v1.jpg',
    dato1Label: 'Ubicación',
    dato1Valor: 'Supatá, Cundinamarca',
    statNumero1: '1600',
    statEtiqueta1: 'msnm',
  });
  await publicarSeccion('origen');

  const publicado = await readSiteContent();
  assert.equal(publicado.origen.visible, true, 'visible debe sobrevivir el schema y publicarse');
  assert.equal(publicado.origen.titulo, 'Un origen real, de principio a fin');
  assert.equal(publicado.origen.imagen1, '/images/finca-1-v1.jpg');
  assert.equal(publicado.origen.dato1Label, 'Ubicación');
  assert.equal(publicado.origen.dato1Valor, 'Supatá, Cundinamarca');
  assert.equal(publicado.origen.statNumero1, '1600');
  assert.equal(publicado.origen.statEtiqueta1, 'msnm');

  const { sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.origen, false, 'publicar debe limpiar el borrador de la sección origen');
});

test('sin fila: origen resuelve byte-idéntico a DEFAULTS.origen (visible sigue en false, "nace OFF")', async () => {
  const publicado = await readSiteContent();
  assert.deepEqual(publicado.origen, DEFAULTS.origen, 'sin fila, origen debe ser byte-idéntico al default');
});
