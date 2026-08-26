import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { guardarBorrador, publicarSeccion, descartarSeccion, setPaginaVisible } from '../../lib/config/site-content-write';

// EL FLUJO BORRADOR/PUBLICADO, contra base real. Se afirma acá y no en la suite pura porque lo
// que importa es qué queda ESCRITO en la fila tras cada operación (content vs borrador), y —lo
// más fino— que publicar una sección NO arrastre el borrador de otra. Un test con mocks pasaría
// contra una escritura que sí las arrastra; hay que releer la fila.
//
// SiteContent es singleton y `limpiar()` de fixtures no lo toca, así que se resetea acá.

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

async function fila() {
  const row = await prisma.siteContent.findUnique({ where: { id: 'default' } });
  return {
    content: (row?.content ?? null) as Record<string, any> | null,
    borrador: (row?.borrador ?? null) as Record<string, any> | null,
  };
}

test('GUARDAR escribe el BORRADOR y NO toca lo publicado', async () => {
  await prisma.siteContent.create({ data: { id: 'default', content: { hero: { titulo: 'PUB' } } } });
  await guardarBorrador({ hero: { titulo: 'DRAFT' } });
  const { content, borrador } = await fila();
  assert.equal(content!.hero.titulo, 'PUB');    // publicado INTACTO
  assert.equal(borrador!.hero.titulo, 'DRAFT'); // borrador escrito
});

test('GUARDAR sin fila previa crea la fila con el borrador (SOFT: no hace falta sembrarla)', async () => {
  await guardarBorrador({ hero: { titulo: 'DRAFT' } });
  const { borrador } = await fila();
  assert.equal(borrador!.hero.titulo, 'DRAFT');
});

test('PUBLICAR mueve la sección del borrador a lo publicado y la saca del borrador', async () => {
  await prisma.siteContent.create({
    data: { id: 'default', content: { hero: { titulo: 'PUB' } }, borrador: { hero: { titulo: 'DRAFT' } } },
  });
  await publicarSeccion('hero');
  const { content, borrador } = await fila();
  assert.equal(content!.hero.titulo, 'DRAFT'); // publicado
  assert.equal(borrador!.hero, undefined);     // fuera del borrador
});

test('DESCARTAR saca la sección del borrador SIN tocar lo publicado', async () => {
  await prisma.siteContent.create({
    data: { id: 'default', content: { hero: { titulo: 'PUB' } }, borrador: { hero: { titulo: 'DRAFT' } } },
  });
  await descartarSeccion('hero');
  const { content, borrador } = await fila();
  assert.equal(content!.hero.titulo, 'PUB'); // publicado INTACTO
  assert.equal(borrador!.hero, undefined);   // borrador limpio
});

test('PUBLICAR una sección NO toca el borrador de OTRA (el leak que "por sección" evita)', async () => {
  // Dos secciones borroneadas; publicar una debe dejar la otra sin tocar. (brandStory acá es sólo
  // una clave JSON —las funciones son key-agnósticas—; el punto es la aislación por sección.)
  await prisma.siteContent.create({
    data: {
      id: 'default',
      content: { hero: { titulo: 'PUB_H' } },
      borrador: { hero: { titulo: 'DRAFT_H' }, brandStory: { titulo: 'DRAFT_B' } },
    },
  });
  await publicarSeccion('hero');
  const { content, borrador } = await fila();
  assert.equal(content!.hero.titulo, 'DRAFT_H');        // hero publicado
  assert.equal(borrador!.hero, undefined);              // hero fuera del borrador
  assert.equal(borrador!.brandStory.titulo, 'DRAFT_B'); // brandStory INTACTO en el borrador
  assert.equal(content!.brandStory, undefined);         // brandStory NO se publicó
});

test('DESCARTAR una sección NO toca el borrador de OTRA', async () => {
  await prisma.siteContent.create({
    data: {
      id: 'default',
      content: {},
      borrador: { hero: { titulo: 'DRAFT_H' }, brandStory: { titulo: 'DRAFT_B' } },
    },
  });
  await descartarSeccion('hero');
  const { borrador } = await fila();
  assert.equal(borrador!.hero, undefined);
  assert.equal(borrador!.brandStory.titulo, 'DRAFT_B'); // la otra sigue
});

test('PUBLICAR devuelve el blob viejo publicado para borrar (write + blob calc juntos, in-use = content ∪ borrador)', async () => {
  await prisma.siteContent.create({
    data: {
      id: 'default',
      content: { hero: { imagen: 'A.jpg', titulo: 'x' } },
      borrador: { hero: { imagen: 'B.jpg', titulo: 'x' } },
    },
  });
  const { blobsABorrar } = await publicarSeccion('hero');
  assert.deepEqual(blobsABorrar, ['A.jpg']); // A ya sin referencias tras publicar B
});

test('GUARDAR una imagen nueva en el borrador NO borra la publicada (aún viva)', async () => {
  await prisma.siteContent.create({ data: { id: 'default', content: { hero: { imagen: 'A.jpg', titulo: 'x' } } } });
  const { blobsABorrar } = await guardarBorrador({ hero: { imagen: 'B.jpg', titulo: 'x' } });
  assert.deepEqual(blobsABorrar, []); // A vive en publicado; B recién entra al borrador
});

// BrandStory es la PRIMERA sección con CUATRO imágenes; se afirma el borrado end-to-end (a través
// del write real, no sólo la función pura) porque es donde el set-diff-no-índice tiene que
// sostenerse contra varios slots.

test('PUBLICAR brandStory (4 imágenes) borra SÓLO la que salió de uso, deja las otras 3', async () => {
  await prisma.siteContent.create({
    data: {
      id: 'default',
      content:  { brandStory: { imagen1: 'A1', imagen2: 'A2', imagen3: 'A3', imagen4: 'A4', titulo: 'x' } },
      borrador: { brandStory: { imagen1: 'A1', imagen2: 'B2', imagen3: 'A3', imagen4: 'A4', titulo: 'x' } }, // sólo imagen2 cambió
    },
  });
  const { blobsABorrar } = await publicarSeccion('brandStory');
  assert.deepEqual(blobsABorrar, ['A2']); // A2 ya sin referencias tras publicar B2; A1/A3/A4 siguen
});

test('PUBLICAR brandStory con un SWAP de posiciones entre las 4 imágenes NO borra ninguna (set-diff, no índice)', async () => {
  await prisma.siteContent.create({
    data: {
      id: 'default',
      content:  { brandStory: { imagen1: 'A1', imagen2: 'A2', imagen3: 'A3', imagen4: 'A4', titulo: 'x' } },
      borrador: { brandStory: { imagen1: 'A2', imagen2: 'A1', imagen3: 'A4', imagen4: 'A3', titulo: 'x' } }, // permutación de las 4
    },
  });
  const { blobsABorrar } = await publicarSeccion('brandStory');
  assert.deepEqual(blobsABorrar, []); // el CONJUNTO de URLs no cambió → nada huérfano, aunque cada slot sí cambió
});

// El toggle de página va DIRECTO a lo publicado (no por borrador); se afirma que escribe el flag y
// NO clobberea el resto del content —es un write que preserva las demás claves—.

test('setPaginaVisible escribe el flag y NO toca el resto del content', async () => {
  await prisma.siteContent.create({ data: { id: 'default', content: { hero: { titulo: 'H' } } } });
  await setPaginaVisible('nosotros', false);
  const { content } = await fila();
  assert.equal(content!.paginas.nosotros.visible, false); // el flag escrito
  assert.equal(content!.hero.titulo, 'H');                // el resto del content, intacto
});

test('setPaginaVisible re-enciende sin perder otras páginas ya guardadas', async () => {
  await prisma.siteContent.create({
    data: { id: 'default', content: { paginas: { nosotros: { visible: false }, otra: { visible: true } } } },
  });
  await setPaginaVisible('nosotros', true);
  const { content } = await fila();
  assert.equal(content!.paginas.nosotros.visible, true); // re-encendida
  assert.equal(content!.paginas.otra.visible, true);     // otra página, intacta
});
