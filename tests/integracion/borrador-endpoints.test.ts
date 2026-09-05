import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { guardarBorrador, publicarSeccion, descartarSeccion, setPaginaVisible, guardarTemaBorrador } from '../../lib/config/site-content-write';

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

// La GALERÍA de /nosotros es el PRIMER repeater CON IMÁGENES que pasa por el write (Testimonios no
// tiene fotos). Se afirma el borrado de blobs POR ÍTEM end-to-end (a través del write real, no sólo
// la función pura): la foto de un ítem reemplazada en el borrador se borra al publicar; un swap de
// posiciones entre ítems no borra ninguna (set-diff, no índice).

test('PUBLICAR nosotrosGaleria borra SÓLO la foto del ítem que se reemplazó', async () => {
  await prisma.siteContent.create({
    data: {
      id: 'default',
      content:  { nosotrosGaleria: { items: [{ url: 'A', alt: '' }, { url: 'B', alt: '' }] } },
      borrador: { nosotrosGaleria: { items: [{ url: 'X', alt: '' }, { url: 'B', alt: '' }] } }, // ítem 0: A→X
    },
  });
  const { blobsABorrar } = await publicarSeccion('nosotrosGaleria');
  assert.deepEqual(blobsABorrar, ['A']); // A ya sin referencias; X publicado, B sigue
});

test('PUBLICAR nosotrosGaleria con un SWAP de ítems NO borra ninguna foto (set-diff por ítem)', async () => {
  await prisma.siteContent.create({
    data: {
      id: 'default',
      content:  { nosotrosGaleria: { items: [{ url: 'A' }, { url: 'B' }] } },
      borrador: { nosotrosGaleria: { items: [{ url: 'B' }, { url: 'A' }] } }, // reordenadas
    },
  });
  const { blobsABorrar } = await publicarSeccion('nosotrosGaleria');
  assert.deepEqual(blobsABorrar, []); // el CONJUNTO de urls no cambió, aunque el orden sí
});

test('PUBLICAR: quitar un ítem-VÍDEO de la galería borra sus DOS blobs (url + poster)', async () => {
  // El ítem-vídeo aporta `url` (el vídeo) y `poster` (su imagen) al borrado, por `imagenes:['url','poster']`.
  await prisma.siteContent.create({
    data: {
      id: 'default',
      content:  { nosotrosGaleria: { items: [{ url: '/foto.jpg' }, { url: '/finca.mp4', poster: '/finca-poster.jpg', tipo: 'video' }] } },
      borrador: { nosotrosGaleria: { items: [{ url: '/foto.jpg' }] } }, // el vídeo quitado
    },
  });
  const { blobsABorrar } = await publicarSeccion('nosotrosGaleria');
  assert.deepEqual(blobsABorrar.sort(), ['/finca-poster.jpg', '/finca.mp4']); // los dos blobs del vídeo
});

test('QUITAR una foto del BORRADOR NO borra el blob mientras sigue en lo PUBLICADO; publicar lo borra', async () => {
  // El caso que la confirmación de borrado promete (§ la confirmación): quitar del borrador es
  // ESCALONADO y reversible hasta publicar. El set-diff lo cubre (en-uso = content ∪ borrador);
  // acá se afirma con el caso exacto de quitar-un-ítem, no reemplazar.
  await prisma.siteContent.create({
    data: { id: 'default', content: { nosotrosGaleria: { items: [{ url: 'A' }, { url: 'B' }] } } }, // A y B publicadas
  });
  // Guardar el borrador con B QUITADA: B sigue viva en lo publicado → NO se borra.
  const g = await guardarBorrador({ nosotrosGaleria: { items: [{ url: 'A' }] } });
  assert.deepEqual(g.blobsABorrar, []);
  // Publicar la sección: recién ahí lo publicado pierde B → se borra.
  const p = await publicarSeccion('nosotrosGaleria');
  assert.deepEqual(p.blobsABorrar, ['B']);
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

// EL TEMA (la paleta) por el MISMO flujo borrador/publicado. Guarda con su propia función
// (`guardarTemaBorrador`, validación distinta) pero PUBLICA/DESCARTA reusando las key-agnósticas
// `publicarSeccion('tema')`/`descartarSeccion('tema')`. Se afirma contra base real porque lo que
// importa es qué queda ESCRITO (content.tema vs borrador.tema) y que el tema NO arrastre secciones.

// El tema COMPLETO: las 3 raíces + el par tipográfico (§ Tanda C2 · #3). Un par CUSTOM ejercita el
// round-trip guardar→publicar→descartar del par junto con la paleta (un solo objeto, un solo borrador).
const RAICES = { fondo: '#101010', tinta: '#f0f0f0', acento: '#c04000', fuentePar: 'moderno' };

test('GUARDAR TEMA escribe borrador.tema y NO toca lo publicado', async () => {
  await prisma.siteContent.create({ data: { id: 'default', content: { tema: { fondo: '#000000', tinta: '#ffffff', acento: '#8b4513' } } } });
  await guardarTemaBorrador(RAICES);
  const { content, borrador } = await fila();
  assert.deepEqual(content!.tema, { fondo: '#000000', tinta: '#ffffff', acento: '#8b4513' }); // publicado INTACTO
  assert.deepEqual(borrador!.tema, RAICES);                                                    // borrador escrito
});

test('GUARDAR TEMA sin fila previa crea la fila con el borrador (SOFT)', async () => {
  await guardarTemaBorrador(RAICES);
  const { borrador } = await fila();
  assert.deepEqual(borrador!.tema, RAICES);
});

test('PUBLICAR TEMA mueve borrador.tema a content.tema y lo saca del borrador; sin blobs', async () => {
  await prisma.siteContent.create({
    data: { id: 'default', content: { tema: { fondo: '#000000', tinta: '#ffffff', acento: '#8b4513' } }, borrador: { tema: RAICES } },
  });
  const { blobsABorrar } = await publicarSeccion('tema');
  const { content, borrador } = await fila();
  assert.deepEqual(content!.tema, RAICES);      // publicado
  assert.equal(borrador!.tema, undefined);      // fuera del borrador
  assert.deepEqual(blobsABorrar, []);           // la paleta no tiene imágenes
});

test('DESCARTAR TEMA saca borrador.tema SIN tocar lo publicado (vuelve al tema publicado)', async () => {
  const publicado = { fondo: '#000000', tinta: '#ffffff', acento: '#8b4513' };
  await prisma.siteContent.create({ data: { id: 'default', content: { tema: publicado }, borrador: { tema: RAICES } } });
  await descartarSeccion('tema');
  const { content, borrador } = await fila();
  assert.deepEqual(content!.tema, publicado); // publicado INTACTO
  assert.equal(borrador!.tema, undefined);    // borrador limpio
});

test('PUBLICAR TEMA con las 3 raíces en null (volver a FÁBRICA) publica los nulls, no arrastra secciones', async () => {
  // "Usar el tema por defecto": guardar borrador.tema con nulls → publicar → content.tema = nulls →
  // el storefront cae a los defaults de código. Y publicar el tema NO toca el borrador de una sección.
  await prisma.siteContent.create({
    data: { id: 'default', content: { tema: RAICES }, borrador: { tema: { fondo: null, tinta: null, acento: null }, hero: { titulo: 'DRAFT_H' } } },
  });
  await publicarSeccion('tema');
  const { content, borrador } = await fila();
  assert.deepEqual(content!.tema, { fondo: null, tinta: null, acento: null }); // fábrica publicada
  assert.equal(borrador!.tema, undefined);              // tema fuera del borrador
  assert.equal(borrador!.hero.titulo, 'DRAFT_H');       // el borrador del hero, INTACTO (no arrastrado)
});
