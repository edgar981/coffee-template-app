import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion } from '../../lib/config/site-content-write';
import { readSiteContent, readSiteContentParaEditor } from '../../lib/config/site-content-read';
import { DEFAULTS } from '../../lib/config/site-content-defaults';

// EL VIAJE DE PUNTA A PUNTA del PIN del spotlight (§ PANEL-EDITOR-SPOTLIGHT-PIN-1). `spotlight` SÍ
// es una sección del REGISTRY (a diferencia del Encabezado, § panel-encabezado.test.ts), así que va
// por el camino GENÉRICO de `/api/site-content` — simulado igual que presentaciones-viaje.test.ts /
// menu-badge.test.ts: parsear con el schema real (donde zod strippearía `productoSlug`/
// `otroTamanoSlug` si `spotlightEditableSchema` no los declarara — YA los declara, §
// site-content-schema.ts, sin cambios de este slice) → `guardarBorrador` → `publicarSeccion
// ('spotlight')` → releer con `readSiteContent`, lo mismo que `Spotlight.tsx` resuelve con
// `productoSpotlight`/`productoOtraTalla`. Prueba que el CONTROL nuevo (`SPOTLIGHT` en
// tienda-secciones.ts) mueve el dato de verdad hasta el storefront, no sólo que el editor renderiza
// dos inputs.

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

/** Simula EXACTAMENTE el PUT de la ruta genérica: parsea el body con el schema real y guarda el
 *  resultado en el borrador. */
async function guardarComoElRoute(spotlight: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse({ spotlight });
  await guardarBorrador(parsed);
}

test('pin de punta a punta: productoSlug+otroTamanoSlug sobreviven borrador→publicar→releer, y el borrador queda limpio', async () => {
  await guardarComoElRoute({ productoSlug: 'cafe-narino', otroTamanoSlug: 'cafe-narino-1kg' });
  await publicarSeccion('spotlight');

  const publicado = await readSiteContent();
  assert.equal(publicado.spotlight.productoSlug, 'cafe-narino', 'productoSlug debe sobrevivir el schema y publicarse');
  assert.equal(publicado.spotlight.otroTamanoSlug, 'cafe-narino-1kg', 'otroTamanoSlug debe sobrevivir el schema y publicarse');

  const { sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.spotlight, false, 'publicar debe limpiar el borrador de la sección spotlight');
});

test('pin vacío: productoSlug/otroTamanoSlug en blanco publican spotlight byte-idéntico a DEFAULTS.spotlight', async () => {
  await guardarComoElRoute({ productoSlug: '', otroTamanoSlug: '' });
  await publicarSeccion('spotlight');

  const publicado = await readSiteContent();
  assert.deepEqual(publicado.spotlight, DEFAULTS.spotlight, 'sin pin, spotlight publicado debe ser byte-idéntico al default (visible sigue en false)');
});
