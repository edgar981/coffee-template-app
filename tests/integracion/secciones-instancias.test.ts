import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion, descartarSeccion } from '../../lib/config/site-content-write';
import { publicarVariasSecciones, descartarVariasSecciones } from '../../app/api/site-content/route';
import { readSiteContent, readSiteContentParaEditor } from '../../lib/config/site-content-read';
import { BANDA_IDS } from '../../lib/config/site-content-defaults';

// EL VIAJE DE PUNTA A PUNTA de las SECCIONES AGREGADAS del home (§ SECCIONES-INSTANCIAS-1):
// guardar → el ROUTE lo pasa por `siteContentEditableSchema` (como `orden-secciones.test.ts`/
// `presentaciones-viaje.test.ts`) → `guardarBorrador` → publicar/descartar (`publicarSeccion`/
// `descartarSeccion('seccionesHome')`, key-agnósticas — NO pasan por el REGISTRY) → y el storefront
// lo lee por `readSiteContent`, exactamente como `app/(storefront)/page.tsx`.
//
// `seccionesHome` es clave META (fuera del REGISTRY, `SeccionKey` la excluye) — un test que llamara
// a `publicarSeccion('seccionesHome')` sin pasar antes por el schema real NO afirmaría que el PUT
// del route de verdad acepta esta clave; por eso éste, como los otros viajes de esta carpeta, pasa
// por el schema primero.

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

/** Simula EXACTAMENTE el PUT de `/api/site-content`: parsea el body con el schema real. */
async function guardarComoElRoute(data: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse(data);
  await guardarBorrador(parsed);
}

test('crear una instancia, guardar y publicar: el storefront la ve resuelta, y su id entra a `orden` al final', async () => {
  await guardarComoElRoute({
    seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'Mi sección nueva', texto: 'cuerpo' } },
  });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.equal(Object.keys(publicado.seccionesHome).length, 1);
  assert.deepEqual(publicado.seccionesHome['inst:a'], {
    tipo: 'texto',
    antetitulo: '',
    titulo: 'Mi sección nueva',
    texto: 'cuerpo',
    ctaLabel: '',
    ctaDestino: '',
    alineacion: 'centro',
    visible: true,
  });
  // Nunca se publicó `orden` explícitamente -> el resolver la agrega AL FINAL de las 9 bandas.
  assert.deepEqual(publicado.orden, [...BANDA_IDS, 'inst:a']);
});

// ─── EL OJO (§ SECCIONES-INSTANCIAS-VIVO-1) — EL VIAJE COMPLETO DE `visible` ─────────────────────
//
// El schema puede declarar `visible` y el resolver puede resolverlo correctamente SIN que eso
// pruebe que el viaje real (el PUT que valida con el schema real → el borrador en la base → publicar
// → el storefront releyendo) lo conserve de punta a punta — exactamente la razón por la que esta
// carpeta existe (§ el docstring de cabecera de este archivo). Por eso va por `guardarComoElRoute`
// (el schema real) como el resto de los tests de aquí, nunca construyendo el objeto a mano.

test('ocultar una instancia (`visible:false`) en borrador y publicar: el storefront la relee oculta — el ojo sobrevive el viaje completo', async () => {
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'T', visible: false } } });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.equal((publicado.seccionesHome['inst:a'] as { visible: boolean }).visible, false);
});

test('una instancia creada SIN decir `visible` nace visible (true) tras el viaje completo', async () => {
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'T' } } });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.equal((publicado.seccionesHome['inst:a'] as { visible: boolean }).visible, true);
});

test('re-mostrar una instancia ya oculta: `visible:true` explícito también sobrevive el viaje', async () => {
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'T', visible: false } } });
  await publicarSeccion('seccionesHome');

  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'T', visible: true } } });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.equal((publicado.seccionesHome['inst:a'] as { visible: boolean }).visible, true);
});

test('una instancia Y un orden que la posiciona EN MEDIO de las bandas: el storefront la monta exactamente ahí', async () => {
  const ordenConInstancia = ['hero', 'inst:a', 'marquesina', 'trustBadges', 'featured', 'brandStory', 'origen', 'presentaciones', 'subscriptionCTA', 'testimonials'];
  await guardarComoElRoute({
    seccionesHome: { 'inst:a': { tipo: 'banner', titulo: 'Banner de medio' } },
    orden: ordenConInstancia,
  });
  await publicarVariasSecciones(['seccionesHome', 'orden']);

  const publicado = await readSiteContent();
  assert.deepEqual(publicado.orden, ordenConInstancia);
  assert.equal((publicado.seccionesHome['inst:a'] as { titulo: string }).titulo, 'Banner de medio');
});

test('descartar una instancia en borrador: el storefront sigue sin ella (nunca se publicó)', async () => {
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'Nunca publicada' } } });
  await descartarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.deepEqual(publicado.seccionesHome, {});
  assert.deepEqual(publicado.orden, [...BANDA_IDS]);
});

test('descartar DESPUÉS de publicar: lo ya publicado sobrevive, sólo el borrador posterior se limpia', async () => {
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'V1 publicada' } } });
  await publicarSeccion('seccionesHome');

  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'V2 en borrador, nunca publicada' } } });
  await descartarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.equal((publicado.seccionesHome['inst:a'] as { titulo: string }).titulo, 'V1 publicada');
});

test('un id en seccionesHome SIN el prefijo de instancia (escrito directo, saltando el schema) se descarta al leer — el resolver es SOFT', async () => {
  // Simula basura llegando por otra vía (un dato viejo, una corrección a mano) — el schema del PUT
  // rechazaría esto, pero `resolverSeccionesHome` es la última red SOFT.
  await prisma.siteContent.create({ data: { id: 'default', content: { seccionesHome: { 'sin-prefijo': { tipo: 'texto', titulo: 'x' } } } } });
  const publicado = await readSiteContent();
  assert.deepEqual(publicado.seccionesHome, {});
});

test('el PUT real rechaza un `orden` que mezcla una banda, una instancia con prefijo válido, y una cadena inventada', async () => {
  assert.throws(() => siteContentEditableSchema.parse({ orden: ['hero', 'inst:a', 'no-es-ni-banda-ni-instancia'] }));
  // La MISMA lista SIN la cadena inventada sí sobrevive.
  const parsed = siteContentEditableSchema.parse({ orden: ['hero', 'inst:a'] });
  assert.deepEqual(parsed.orden, ['hero', 'inst:a']);
});

test('el GET del editor (readSiteContentParaEditor) marca sinPublicar.seccionesHome cuando hay un borrador pendiente', async () => {
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'x' } } });
  const { sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.seccionesHome, true);

  await publicarSeccion('seccionesHome');
  const { sinPublicar: despues } = await readSiteContentParaEditor();
  assert.equal(despues.seccionesHome, false);
});

test('una imagen de instancia reemplazada en BORRADOR pero aún PUBLICADA no se borra (mismo contrato que las secciones del REGISTRY)', async () => {
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'banner', titulo: 'B', imagen: 'https://blob/A.jpg' } } });
  await publicarSeccion('seccionesHome');

  // Un segundo guardado reemplaza la imagen SÓLO en el borrador — lo publicado sigue con la vieja.
  const { blobsABorrar } = await guardarBorrador(
    siteContentEditableSchema.parse({ seccionesHome: { 'inst:a': { tipo: 'banner', titulo: 'B', imagen: 'https://blob/X.jpg' } } }),
  );
  assert.deepEqual(blobsABorrar, [], 'A sigue publicada; X es la del borrador — ninguna de las dos es huérfana todavía');

  const publicado = await readSiteContent();
  assert.equal((publicado.seccionesHome['inst:a'] as { imagen: string }).imagen, 'https://blob/A.jpg');
});

test('PUBLICAR una imagen de instancia nueva deja la VIEJA huérfana (ya sin referencias) — SÍ se borra', async () => {
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'banner', titulo: 'B', imagen: 'https://blob/A.jpg' } } });
  await publicarSeccion('seccionesHome');
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'banner', titulo: 'B', imagen: 'https://blob/X.jpg' } } });

  const { blobsABorrar } = await publicarSeccion('seccionesHome');
  assert.deepEqual(blobsABorrar, ['https://blob/A.jpg']);
});
