import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion } from '../../lib/config/site-content-write';
import { readSiteContent, readSiteContentParaEditor } from '../../lib/config/site-content-read';
import { DEFAULTS } from '../../lib/config/site-content-defaults';

// EL VIAJE DE PUNTA A PUNTA de la sección Confianza (§ PANEL-EDITOR-TRUSTBADGES-VISIBLE-1).
// `trustBadges` SÍ es una sección del REGISTRY (su schema —`trustBadgesEditableSchema`— ya declaraba
// el ÚNICO campo, `visible`, ANTES de este slice, § site-content-schema.ts, sin cambios acá), así que
// va por el camino GENÉRICO de `/api/site-content` — simulado igual que marquesina.test.ts /
// origen.test.ts: parsear con el schema real → `guardarBorrador` → `publicarSeccion('trustBadges')` →
// releer con `readSiteContent`, lo mismo que `TrustBadges.tsx` resuelve. Prueba que el CONTROL nuevo
// (`TRUSTBADGES` en tienda-secciones.ts) mueve el dato de verdad hasta el storefront, no sólo que el
// editor renderiza el switch.

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

/** Simula EXACTAMENTE el PUT de la ruta genérica: parsea el body con el schema real y guarda el
 *  resultado en el borrador. */
async function guardarComoElRoute(trustBadges: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse({ trustBadges });
  await guardarBorrador(parsed);
}

test('visible:false sobrevive borrador→publicar→releer — la sección se oculta, y el borrador queda limpio', async () => {
  await guardarComoElRoute({ visible: false });
  await publicarSeccion('trustBadges');

  const publicado = await readSiteContent();
  assert.equal(publicado.trustBadges.visible, false, 'visible:false debe sobrevivir el schema y publicarse');

  const { sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.trustBadges, false, 'publicar debe limpiar el borrador de la sección trustBadges');
});

test('visible:true vuelve a mostrar la sección', async () => {
  await guardarComoElRoute({ visible: false });
  await publicarSeccion('trustBadges');
  assert.equal((await readSiteContent()).trustBadges.visible, false, 'precondición: queda oculta');

  await guardarComoElRoute({ visible: true });
  await publicarSeccion('trustBadges');

  const publicado = await readSiteContent();
  assert.equal(publicado.trustBadges.visible, true, 'visible:true debe volver a mostrar la sección');
});

test('sin fila: trustBadges resuelve byte-idéntico a DEFAULTS.trustBadges (visible sigue en true, "nace HOY")', async () => {
  const publicado = await readSiteContent();
  assert.deepEqual(publicado.trustBadges, DEFAULTS.trustBadges, 'sin fila, trustBadges debe ser byte-idéntico al default');
});
