import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion } from '../../lib/config/site-content-write';
import { readSiteContent, readSiteContentParaEditor } from '../../lib/config/site-content-read';
import { DEFAULTS } from '../../lib/config/site-content-defaults';

// EL VIAJE DE PUNTA A PUNTA del RESTO del spotlight (§ PANEL-EDITOR-SPOTLIGHT-RESTO-1): el texto
// que el prototipo muestra en `.spotlight` (docs/prototipos/cafeone/index.html) —
// `eyebrow`/`titulo`/`badge` — y el toggle `visible`, ahora controlados por `SPOTLIGHT` en
// tienda-secciones.ts (`.ocultable:true` + los tres campos nuevos). Gemelo de
// spotlight-pin.test.ts, mismo camino simulado (parsear con el schema real → `guardarBorrador` →
// `publicarSeccion('spotlight')` → releer con `readSiteContent`, lo que `Spotlight.tsx` lee vía
// `useSiteContent()`), probando ahora los cuatro campos que ese slice dejó exentos en
// `PENDIENTE_PANEL`.

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

/** Simula EXACTAMENTE el PUT de la ruta genérica: parsea el body con el schema real y guarda el
 *  resultado en el borrador. */
async function guardarComoElRoute(spotlight: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse({ spotlight });
  await guardarBorrador(parsed);
}

test('texto de punta a punta: eyebrow+titulo+badge sobreviven borrador→publicar→releer, y el borrador queda limpio', async () => {
  await guardarComoElRoute({
    eyebrow: 'Nuestro café',
    titulo: 'Un solo origen, cuidado de principio a fin.',
    badge: 'Cosecha 2026',
  });
  await publicarSeccion('spotlight');

  const publicado = await readSiteContent();
  assert.equal(publicado.spotlight.eyebrow, 'Nuestro café', 'eyebrow debe sobrevivir el schema y publicarse');
  assert.equal(
    publicado.spotlight.titulo,
    'Un solo origen, cuidado de principio a fin.',
    'titulo debe sobrevivir el schema y publicarse',
  );
  assert.equal(publicado.spotlight.badge, 'Cosecha 2026', 'badge debe sobrevivir el schema y publicarse');

  const { sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.spotlight, false, 'publicar debe limpiar el borrador de la sección spotlight');
});

test('el interruptor visible viaja por el mismo camino: borrador→publicar→releer', async () => {
  await guardarComoElRoute({ visible: true });
  await publicarSeccion('spotlight');

  const publicado = await readSiteContent();
  assert.equal(publicado.spotlight.visible, true, 'visible debe sobrevivir el schema y publicarse');
});

test('texto vacío: eyebrow/titulo/badge en blanco publican spotlight byte-idéntico a DEFAULTS.spotlight', async () => {
  await guardarComoElRoute({ eyebrow: '', titulo: '', badge: '' });
  await publicarSeccion('spotlight');

  const publicado = await readSiteContent();
  assert.deepEqual(
    publicado.spotlight,
    DEFAULTS.spotlight,
    'sin texto, spotlight publicado debe ser byte-idéntico al default (visible sigue en false)',
  );
});
