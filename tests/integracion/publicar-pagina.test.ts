import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador } from '../../lib/config/site-content-write';
import { publicarVariasSecciones, descartarVariasSecciones } from '../../app/api/site-content/route';

// EL "PUBLICAR TODO DE UNA" de la barra de estado (§ EDITOR-TIENDA-DESHACER-1): publicar/descartar
// TODAS las secciones con borrador pendiente de una página, en UN SOLO gesto — "o todas o
// ninguna". `publicarVariasSecciones`/`descartarVariasSecciones` viven en el ROUTE (no en
// `site-content-write.ts`, fuera de `touches:` de este slice, § el docstring de esas dos
// funciones) y se importan DIRECTO acá, sin montar HTTP — el mismo criterio de siempre: lo que hay
// que afirmar contra una base real tiene que ser una función, no un handler.
//
// SiteContent es singleton y `limpiar()` de fixtures no lo toca, así que se resetea acá (mismo
// patrón que `borrador-endpoints.test.ts`/`orden-secciones.test.ts`).

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

async function fila() {
  const row = await prisma.siteContent.findUnique({ where: { id: 'default' } });
  return {
    content: (row?.content ?? null) as Record<string, any> | null,
    borrador: (row?.borrador ?? null) as Record<string, any> | null,
  };
}

/** Simula EXACTAMENTE el PUT de `/api/site-content`: parsea el body con el schema real, como
 *  `orden-secciones.test.ts`/`presentaciones-viaje.test.ts`. */
async function guardarComoElRoute(data: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse(data);
  await guardarBorrador(parsed);
}

test('PUBLICAR VARIAS mueve TODAS las secciones listadas del borrador a lo publicado, de una vez', async () => {
  await prisma.siteContent.create({
    data: {
      id: 'default',
      content: { hero: { titulo: 'PUB_H' } },
      borrador: { hero: { titulo: 'DRAFT_H' }, brandStory: { titulo: 'DRAFT_B' } },
    },
  });
  await publicarVariasSecciones(['hero', 'brandStory']);
  const { content, borrador } = await fila();
  assert.equal(content!.hero.titulo, 'DRAFT_H');
  assert.equal(content!.brandStory.titulo, 'DRAFT_B');
  assert.equal(borrador!.hero, undefined);
  assert.equal(borrador!.brandStory, undefined);
});

test('PUBLICAR VARIAS con una sección SIN borrador en la lista: esa clave es un no-op, las demás publican igual', async () => {
  await prisma.siteContent.create({
    data: {
      id: 'default',
      content: {},
      borrador: { hero: { titulo: 'DRAFT_H' } }, // 'brandStory' NO tiene borrador
    },
  });
  await publicarVariasSecciones(['hero', 'brandStory']);
  const { content, borrador } = await fila();
  assert.equal(content!.hero.titulo, 'DRAFT_H');
  assert.equal(content!.brandStory, undefined); // nunca existió — sigue sin existir
  assert.equal(borrador!.hero, undefined);
});

test('PUBLICAR VARIAS NO toca el borrador de una sección que NO está en la lista', async () => {
  await prisma.siteContent.create({
    data: {
      id: 'default',
      content: {},
      borrador: { hero: { titulo: 'DRAFT_H' }, brandStory: { titulo: 'DRAFT_B' } },
    },
  });
  await publicarVariasSecciones(['hero']); // brandStory no se pide
  const { content, borrador } = await fila();
  assert.equal(content!.hero.titulo, 'DRAFT_H');
  assert.equal(content!.brandStory, undefined);         // no se publicó
  assert.equal(borrador!.brandStory.titulo, 'DRAFT_B'); // su borrador sigue intacto
});

test('PUBLICAR VARIAS sin ninguna coincidencia es un NO-OP TOTAL — no crea fila si no existía', async () => {
  // Sin fila previa: ninguna de las secciones pedidas puede tener borrador.
  await publicarVariasSecciones(['hero', 'brandStory']);
  const row = await prisma.siteContent.findUnique({ where: { id: 'default' } });
  assert.equal(row, null, 'una lista sin ninguna coincidencia no debe escribir nada');
});

test('DESCARTAR VARIAS saca TODAS las secciones listadas del borrador SIN tocar lo publicado', async () => {
  await prisma.siteContent.create({
    data: {
      id: 'default',
      content: { hero: { titulo: 'PUB_H' }, brandStory: { titulo: 'PUB_B' } },
      borrador: { hero: { titulo: 'DRAFT_H' }, brandStory: { titulo: 'DRAFT_B' } },
    },
  });
  await descartarVariasSecciones(['hero', 'brandStory']);
  const { content, borrador } = await fila();
  assert.equal(content!.hero.titulo, 'PUB_H');     // publicado INTACTO
  assert.equal(content!.brandStory.titulo, 'PUB_B');
  assert.equal(borrador!.hero, undefined);
  assert.equal(borrador!.brandStory, undefined);
});

test("DESCARTAR VARIAS deja SIN TOCAR el borrador de una sección fuera de la lista", async () => {
  await prisma.siteContent.create({
    data: {
      id: 'default',
      content: {},
      borrador: { hero: { titulo: 'DRAFT_H' }, origen: { titulo: 'DRAFT_O' } },
    },
  });
  await descartarVariasSecciones(['hero']);
  const { borrador } = await fila();
  assert.equal(borrador!.hero, undefined);
  assert.equal(borrador!.origen.titulo, 'DRAFT_O');
});

// 'orden'/'tema' son claves META (fuera del REGISTRY) — las mismas funciones las mueven igual,
// key-agnósticas como sus hermanas de una sola sección (`publicarSeccion`/`descartarSeccion`).

test("PUBLICAR VARIAS incluye 'orden' y 'tema' junto a secciones del REGISTRY, en el MISMO gesto", async () => {
  await prisma.siteContent.create({
    data: {
      id: 'default',
      content: {},
      borrador: {
        hero: { titulo: 'DRAFT_H' },
        orden: ['marquesina', 'hero'],
        tema: { fondo: '#101010', tinta: null, acento: null, fuentePar: null, forma: null },
      },
    },
  });
  await publicarVariasSecciones(['hero', 'orden', 'tema']);
  const { content, borrador } = await fila();
  assert.equal(content!.hero.titulo, 'DRAFT_H');
  assert.deepEqual(content!.orden, ['marquesina', 'hero']);
  assert.deepEqual(content!.tema, { fondo: '#101010', tinta: null, acento: null, fuentePar: null, forma: null });
  assert.equal(borrador!.hero, undefined);
  assert.equal(borrador!.orden, undefined);
  assert.equal(borrador!.tema, undefined);
});

// Los blobs huérfanos se calculan sobre el LOTE completo (content antes/después de mover TODAS las
// secciones a la vez), no sección por sección — mismo invariante que `publicarSeccion` ya afirma
// para una sola sección (`borrador-endpoints.test.ts`), ahora sobre dos secciones en UNA llamada.

test('PUBLICAR VARIAS devuelve los blobs huérfanos de TODO el lote (dos secciones con imagen, una llamada)', async () => {
  await prisma.siteContent.create({
    data: {
      id: 'default',
      content: {
        hero: { imagen: 'HERO_A.jpg', titulo: 'x' },
        nosotrosHistoria: { imagen: 'HIST_A.jpg', titulo: 'x' },
      },
      borrador: {
        hero: { imagen: 'HERO_B.jpg', titulo: 'x' },
        nosotrosHistoria: { imagen: 'HIST_B.jpg', titulo: 'x' },
      },
    },
  });
  const { blobsABorrar } = await publicarVariasSecciones(['hero', 'nosotrosHistoria']);
  assert.deepEqual(blobsABorrar.sort(), ['HERO_A.jpg', 'HIST_A.jpg'].sort());
});

test('DESCARTAR VARIAS borra el blob del borrador que queda huérfano, sin tocar el publicado vivo', async () => {
  await prisma.siteContent.create({
    data: {
      id: 'default',
      content: { hero: { imagen: 'HERO_A.jpg', titulo: 'x' } },
      borrador: { hero: { imagen: 'HERO_B.jpg', titulo: 'x' } }, // B sólo vive en el borrador
    },
  });
  const { blobsABorrar } = await descartarVariasSecciones(['hero']);
  assert.deepEqual(blobsABorrar, ['HERO_B.jpg']); // B queda sin referencias; A sigue publicado
  const { content } = await fila();
  assert.equal(content!.hero.imagen, 'HERO_A.jpg');
});

// EL VIAJE COMPLETO por el PUT real (el schema que de verdad valida lo que el panel manda) antes
// del publish en lote — mismo patrón que `orden-secciones.test.ts`.

test('el viaje completo: PUT real (schema) de dos secciones, luego PUBLICAR VARIAS, luego lo lee el storefront', async () => {
  await guardarComoElRoute({ hero: { titulo: 'El titular nuevo' }, brandStory: { titulo: 'La historia nueva' } });
  await publicarVariasSecciones(['hero', 'brandStory']);
  const { content, borrador } = await fila();
  assert.equal(content!.hero.titulo, 'El titular nuevo');
  assert.equal(content!.brandStory.titulo, 'La historia nueva');
  assert.equal(borrador!.hero, undefined);
  assert.equal(borrador!.brandStory, undefined);
});

// § SECCIONES-INSTANCIAS-1 — `seccionesHome` es META (fuera del REGISTRY), pero entra a la MISMA
// lista whitelisteada que 'orden'/'tema' en `app/api/site-content/route.ts`, así que "PUBLICAR
// VARIAS" debe aceptarla EN LA MISMA tanda que una sección real del REGISTRY, de una sola vez.
test('PUBLICAR VARIAS acepta "seccionesHome" junto con una sección del REGISTRY, en el mismo gesto atómico', async () => {
  await guardarComoElRoute({
    hero: { titulo: 'El titular nuevo' },
    seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'Agregada' } },
  });
  await publicarVariasSecciones(['hero', 'seccionesHome']);
  const { content, borrador } = await fila();
  assert.equal(content!.hero.titulo, 'El titular nuevo');
  assert.equal((content!.seccionesHome['inst:a'] as { titulo: string }).titulo, 'Agregada');
  assert.equal(borrador!.hero, undefined);
  assert.equal(borrador!.seccionesHome, undefined);
});
