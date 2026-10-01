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

// § DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1 — el TERCER puntero (`presentacionSlug`), gemelo de
// `otroTamanoSlug`, por el MISMO viaje de punta a punta (parsear con el schema real → guardar
// borrador → publicar → releer). El NOMBRE y el viaje no cambiaron con § DESTACADO-PRESENTACION-
// POR-TAMANO-1 (que agregó el cuarto puntero, `cuartoSlug`, probado en spotlight-pin.test.ts): los
// tres punteros de este test siguen sobreviviendo el MISMO schema sin tocar una línea — es la
// migración sin pérdida que ese slice pedía.
test('presentacionSlug (el tercer pin, "otra presentación") sobrevive borrador→publicar→releer, igual que productoSlug/otroTamanoSlug', async () => {
  await guardarComoElRoute({
    productoSlug: 'cafe-la-ceiba-grano-500',
    presentacionSlug: 'cafe-la-ceiba-molido-500',
    otroTamanoSlug: 'cafe-la-ceiba-grano-250',
  });
  await publicarSeccion('spotlight');

  const publicado = await readSiteContent();
  assert.equal(publicado.spotlight.productoSlug, 'cafe-la-ceiba-grano-500');
  assert.equal(publicado.spotlight.presentacionSlug, 'cafe-la-ceiba-molido-500');
  assert.equal(publicado.spotlight.otroTamanoSlug, 'cafe-la-ceiba-grano-250');
});

// § DESTACADO-NOMBRE-GRUPO-Y-TRANSICION-1 — el título FIJO del café (`nombreCafe`), por el MISMO
// viaje de punta a punta: parsear con el schema real → guardar borrador → publicar → releer. La
// derivación (sin el campo, se corta el nombre del producto en " — ") la prueba
// `lib/config/spotlight.test.ts` (`nombreCafeSpotlight`, capa 1, pura) — acá sólo se afirma que el
// campo EDITORIAL sobrevive el schema, como el resto de `spotlight`.
test('nombreCafe (el título fijo del café) sobrevive borrador→publicar→releer', async () => {
  await guardarComoElRoute({ nombreCafe: 'Café Onix' });
  await publicarSeccion('spotlight');

  const publicado = await readSiteContent();
  assert.equal(publicado.spotlight.nombreCafe, 'Café Onix');
});

test('nombreCafe vacío publica spotlight byte-idéntico a DEFAULTS.spotlight, igual que eyebrow/titulo/badge', async () => {
  await guardarComoElRoute({ nombreCafe: '' });
  await publicarSeccion('spotlight');

  const publicado = await readSiteContent();
  assert.deepEqual(publicado.spotlight, DEFAULTS.spotlight);
});
