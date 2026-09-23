import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion } from '../../lib/config/site-content-write';
import { readSiteContent, readSiteContentParaEditor } from '../../lib/config/site-content-read';
import { DEFAULTS, itemsDeMenu } from '../../lib/config/site-content-defaults';

// EL VIAJE DE PUNTA A PUNTA del BADGE del menú (§ PANEL-EDITOR-MENU-BADGE-1). `menu` SÍ es una
// sección del REGISTRY (a diferencia del Encabezado, § panel-encabezado.test.ts), así que va por el
// camino GENÉRICO de `/api/site-content` — simulado acá igual que en presentaciones-viaje.test.ts:
// parsear con el schema real (donde zod strippearía badgeItem/badgeTexto si no estuvieran
// declarados en `menuEditableSchema`) → guardarBorrador → publicarSeccion('menu') → releer con
// `readSiteContent`, lo único que el storefront lee. Prueba que el CONTROL nuevo mueve el dato de
// verdad, no sólo que renderiza — el mismo discriminador que ya exige `site-content-schema.test.ts`
// para cualquier campo nuevo del schema.

const MENU_BASE = {
  visible: true,
  labelTienda: 'Tienda', labelSuscripciones: 'Suscripciones', labelNosotros: 'Nosotros',
  posicion1: 'tienda', posicion2: 'suscripciones', posicion3: 'nosotros',
  ctaLabel: '', ctaDestino: '',
};

/** Simula EXACTAMENTE el PUT de la ruta genérica: parsea el body con el schema real y guarda el
 *  resultado en el borrador. */
async function guardarComoElRoute(menu: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse({ menu });
  return guardarBorrador(parsed);
}

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

test('badge de punta a punta: badgeItem+badgeTexto sobreviven borrador→publicar→releer, y el borrador queda limpio', async () => {
  await guardarComoElRoute({ ...MENU_BASE, badgeItem: 'tienda', badgeTexto: 'Cosecha 2026' });
  await publicarSeccion('menu');

  const publicado = await readSiteContent();
  assert.equal(publicado.menu.badgeItem, 'tienda');
  assert.equal(publicado.menu.badgeTexto, 'Cosecha 2026');

  const { sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.menu, false, 'publicar debe limpiar el borrador de la sección menú');

  // Y lo que el STOREFRONT lee (`StoreNav.tsx`, vía `itemsDeMenu`) trae el badge adjunto al ítem.
  const items = itemsDeMenu(publicado);
  const tienda = items.find((i) => i.id === 'tienda');
  assert.equal(tienda?.badge, 'Cosecha 2026', 'el ítem tienda debe llevar el badge publicado');
});

test('badgeItem="" (ninguno): el resultado es byte-idéntico al default — sin badge en ningún ítem', async () => {
  await guardarComoElRoute({ ...MENU_BASE, badgeItem: '', badgeTexto: '' });
  await publicarSeccion('menu');

  const publicado = await readSiteContent();
  assert.deepEqual(publicado.menu, DEFAULTS.menu, 'sin badge, el menú publicado debe ser byte-idéntico al default');

  const items = itemsDeMenu(publicado);
  assert.ok(items.every((i) => i.badge === undefined), 'ningún ítem debe llevar `badge` sin badgeItem elegido');
});
