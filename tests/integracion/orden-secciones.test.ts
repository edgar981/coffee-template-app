import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion, descartarSeccion } from '../../lib/config/site-content-write';
import { readSiteContent } from '../../lib/config/site-content-read';
import { resolverOrden, BANDA_IDS } from '../../lib/config/site-content-defaults';

// EL VIAJE DE PUNTA A PUNTA del ORDEN de bandas del home (§ EDITOR-TIENDA-ORDEN-1): guardar → el
// ROUTE lo pasa por `siteContentEditableSchema` (como presentaciones-viaje.test.ts) → `guardarBorrador`
// → publicar/descartar (`publicarSeccion`/`descartarSeccion('orden')`, key-agnósticas — NO pasan por
// el REGISTRY, § site-content-write.ts) → y el storefront lo lee por `readSiteContent` +
// `resolverOrden`, exactamente como `app/(storefront)/page.tsx`.
//
// 'orden' es clave META (fuera del REGISTRY, `SeccionKey` la excluye) — un test que llamara a
// `publicarSeccion('orden')` sin pasar antes por el schema real NO afirmaría que el PUT del route
// (`siteContentEditableSchema.parse`) de verdad acepta esta clave; por eso éste, como los otros
// viajes de esta carpeta, pasa por el schema primero.

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

/** Simula EXACTAMENTE el PUT de `/api/site-content`: parsea el body con el schema real. */
async function guardarComoElRoute(data: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse(data);
  await guardarBorrador(parsed);
}

test('reordenar, guardar y publicar: el storefront ve el nuevo orden', async () => {
  const nuevoOrden = ['marquesina', 'hero', 'trustBadges', 'featured', 'brandStory', 'origen', 'presentaciones', 'subscriptionCTA', 'testimonials'];
  await guardarComoElRoute({ orden: nuevoOrden });
  await publicarSeccion('orden');

  const publicado = await readSiteContent();
  assert.deepEqual(resolverOrden(publicado.orden), nuevoOrden, 'el orden publicado debe ser exactamente el que se guardó');
});

test('reordenar, guardar y DESCARTAR: el storefront sigue viendo el orden de ANTES (nunca el borrador)', async () => {
  // Primero un orden real PUBLICADO (simula un reorder anterior ya en vivo).
  const ordenPublicadoOriginal = ['hero', 'marquesina', 'origen', 'trustBadges', 'featured', 'brandStory', 'presentaciones', 'subscriptionCTA', 'testimonials'];
  await guardarComoElRoute({ orden: ordenPublicadoOriginal });
  await publicarSeccion('orden');

  // Ahora un SEGUNDO reorder, guardado pero NO publicado.
  await guardarComoElRoute({ orden: [...ordenPublicadoOriginal].reverse() });
  await descartarSeccion('orden');

  const publicado = await readSiteContent();
  assert.deepEqual(resolverOrden(publicado.orden), ordenPublicadoOriginal, 'descartar no debe mover el orden publicado');
});

test('un orden con un id repetido o uno fuera del set cerrado es rechazado por el SCHEMA (no llega a guardarse)', async () => {
  assert.throws(() => siteContentEditableSchema.parse({ orden: ['hero', 'hero', 'marquesina'] }), /repetirse/);
  assert.throws(() => siteContentEditableSchema.parse({ orden: ['hero', 'inventada'] }));
});

test('un orden PARCIAL guardado se completa con las bandas faltantes al releer (resolverOrden, nunca se pierde una banda)', async () => {
  // Simula basura/un array incompleto llegando a la base por otra vía (p. ej. un dato viejo) — el
  // schema del PUT rechazaría esto, pero `resolverOrden` es la última red SOFT, igual que para
  // cualquier otro `orden` corrupto (§ su docstring).
  await guardarComoElRoute({ orden: ['brandStory', 'hero'] });
  await publicarSeccion('orden');

  const publicado = await readSiteContent();
  const resuelto = resolverOrden(publicado.orden);
  assert.equal(resuelto.length, BANDA_IDS.length, 'ninguna banda puede caerse del home por un orden incompleto');
  assert.deepEqual(resuelto.slice(0, 2), ['brandStory', 'hero'], 'las dos elegidas quedan primero, en el orden pedido');
  assert.deepEqual(new Set(resuelto), new Set(BANDA_IDS), 'el resto se completa con las bandas faltantes');
});

test('guardar el orden NO toca ninguna otra sección del borrador (otra clave que ya estaba guardada)', async () => {
  await guardarComoElRoute({ hero: { titulo: 'Un titular en borrador' } });
  await guardarComoElRoute({ orden: ['marquesina', 'hero', 'trustBadges', 'featured', 'brandStory', 'origen', 'presentaciones', 'subscriptionCTA', 'testimonials'] });
  await publicarSeccion('hero');
  await publicarSeccion('orden');

  const publicado = await readSiteContent();
  assert.equal(publicado.hero.titulo, 'Un titular en borrador', 'el guardado de orden no debe pisar el borrador de hero');
});
