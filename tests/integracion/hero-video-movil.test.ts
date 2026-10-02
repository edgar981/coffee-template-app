import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion } from '../../lib/config/site-content-write';
import { readSiteContent } from '../../lib/config/site-content-read';
import { HERO_VIDEO_MOVIL_MEDIA, fuentesVideoHero, tieneVideoMovil } from '../../lib/config/hero-video';

// EL VIAJE DE PUNTA A PUNTA del video de teléfono (§ HERO-VIDEO-MOVIL-1): el editor manda el form →
// el ROUTE lo pasa por `siteContentEditableSchema` (donde zod STRIPPEARÍA un campo no declarado, §
// #65-B) → `guardarBorrador` → `publicarSeccion` → y el storefront decide la fuente con
// `fuentesVideoHero` (lib/config/hero-video.ts). Mismo patrón que `presentaciones-viaje.test.ts`: un
// test con mocks o que llame a `guardarBorrador` directo con un objeto a mano NO pasa por el schema
// real, así que no atraparía un campo nuevo que el schema olvidó declarar.

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

/** Simula EXACTAMENTE el paso del route: parsea con el schema real y guarda el resultado. */
async function guardarComoElRoute(data: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse({ hero: data });
  return guardarBorrador(parsed);
}

test('de punta a punta: imagenMovil/imagenMovilPoster sobreviven borrador→publicar→releer, y el storefront elige bien', async () => {
  await guardarComoElRoute({
    imagenTipo: 'video',
    imagen: '/v-escritorio.mp4',
    imagenPoster: '/p-escritorio.jpg',
    imagenMovil: '/v-movil.mp4',
    imagenMovilPoster: '/p-movil.jpg',
  });
  await publicarSeccion('hero');

  const hero = (await readSiteContent()).hero;
  assert.equal(hero.imagenMovil, '/v-movil.mp4', 'imagenMovil debe sobrevivir el schema (si no, se strippea en silencio, § #65-B)');
  assert.equal(hero.imagenMovilPoster, '/p-movil.jpg');
  // El storefront elige bien: el móvil primero con su media, el de escritorio como comodín.
  assert.deepEqual(fuentesVideoHero(hero), [
    { src: '/v-movil.mp4', media: HERO_VIDEO_MOVIL_MEDIA },
    { src: '/v-escritorio.mp4' },
  ]);
});

test('el schema RECHAZA imagenMovil sin su propio póster — mismo criterio que el video de escritorio', async () => {
  await assert.rejects(() => guardarComoElRoute({
    imagenTipo: 'video',
    imagen: '/v.mp4',
    imagenPoster: '/p.jpg',
    imagenMovil: '/v-movil.mp4',
    // imagenMovilPoster ausente — debe rechazarse, no quedar a medias.
  }));
});

test('el schema RECHAZA imagenMovil con un póster en blanco (sólo espacios) — "" y "   " son el mismo caso', async () => {
  await assert.rejects(() => guardarComoElRoute({
    imagenTipo: 'video',
    imagen: '/v.mp4',
    imagenPoster: '/p.jpg',
    imagenMovil: '/v-movil.mp4',
    imagenMovilPoster: '   ',
  }));
});

test('sin video de teléfono: el campo se guarda vacío y el storefront no ve ninguna fuente móvil — byte-idéntico a hoy', async () => {
  await guardarComoElRoute({
    imagenTipo: 'video',
    imagen: '/v.mp4',
    imagenPoster: '/p.jpg',
  });
  await publicarSeccion('hero');

  const hero = (await readSiteContent()).hero;
  assert.equal(hero.imagenMovil, '');
  assert.equal(hero.imagenMovilPoster, '');
  assert.equal(tieneVideoMovil(hero), false);
  assert.deepEqual(fuentesVideoHero(hero), [{ src: '/v.mp4' }]);
});

test('un hero de IMAGEN con imagenMovil declarado pasa el schema (no exige imagenTipo:"video") pero el storefront nunca lo consulta', async () => {
  // El `.refine()` nuevo NO cruza con `imagenTipo` — un `imagenMovil` sin que el hero sea video queda
  // DORMIDO, no es un estado inválido. `fuentesVideoHero` igual lo devolvería si se le pasara "hero"
  // de video; el punto de este test es que los COMPONENTES (HeroMedia.tsx/HeroMediaMarquesina.tsx)
  // sólo llaman a `fuentesVideoHero` cuando `imagenTipo === 'video'` — eso se verifica leyendo el
  // código de esos dos componentes (fuera del alcance de un test de datos), acá sólo se afirma que
  // el PAR sobrevive el schema sin exigir el cruce.
  await guardarComoElRoute({
    imagenTipo: 'imagen',
    imagen: '/foto.jpg',
    imagenMovil: '/v-movil-dormido.mp4',
    imagenMovilPoster: '/p-movil-dormido.jpg',
  });
  await publicarSeccion('hero');

  const hero = (await readSiteContent()).hero;
  assert.equal(hero.imagenMovil, '/v-movil-dormido.mp4');
  assert.equal(tieneVideoMovil(hero), true);
});

test('el borrado de blobs incluye el video/póster de teléfono reemplazados tras PUBLICAR (REGISTRY.hero.imagenes los nombra)', async () => {
  await guardarComoElRoute({
    imagenTipo: 'video',
    imagen: '/v.mp4',
    imagenPoster: '/p.jpg',
    imagenMovil: '/v-movil-viejo.mp4',
    imagenMovilPoster: '/p-movil-viejo.jpg',
  });
  await publicarSeccion('hero');

  await guardarComoElRoute({
    imagenTipo: 'video',
    imagen: '/v.mp4',
    imagenPoster: '/p.jpg',
    imagenMovil: '/v-movil-nuevo.mp4',
    imagenMovilPoster: '/p-movil-nuevo.jpg',
  });
  const { blobsABorrar } = await publicarSeccion('hero');

  assert.ok(blobsABorrar.includes('/v-movil-viejo.mp4'), 'el video móvil REEMPLAZADO debe marcarse para borrar');
  assert.ok(blobsABorrar.includes('/p-movil-viejo.jpg'), 'el póster móvil REEMPLAZADO debe marcarse para borrar');
  assert.ok(!blobsABorrar.includes('/v-movil-nuevo.mp4'), 'el NUEVO video móvil sigue en uso, no se borra');
});
