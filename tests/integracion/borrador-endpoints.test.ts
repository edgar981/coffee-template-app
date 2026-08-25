import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { guardarBorrador, publicarSeccion, descartarSeccion } from '../../lib/config/site-content-write';

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
